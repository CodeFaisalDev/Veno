// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// @ts-ignore
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // CORS check
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  let documentPathToDelete: string | null = null;
  let supabaseClientInstance: any = null;

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Initialize Supabase Client with Service Role (bypass user RLS and delete files)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Database environment variables are missing' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    supabaseClientInstance = createClient(supabaseUrl, supabaseServiceKey)
    
    // Verify user session JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClientInstance.auth.getUser(token)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized session or token expired' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const { documentPath } = await req.json()
    if (!documentPath) {
      return new Response(
        JSON.stringify({ error: 'Missing documentPath in request body' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    documentPathToDelete = documentPath;
    
    // 1. Download image from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseClientInstance
      .storage
      .from('identity-documents')
      .download(documentPath)
       
    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({ error: `File download from storage failed: ${downloadError?.message || 'Empty file data'}` }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // 2. Convert file data to Base64
    const arrayBuffer = await fileData.arrayBuffer()
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    
    // 3. Send to Gemini Vision API
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key is not configured in environment' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`
    
    // Determine mime type based on path extension
    let mimeType = 'image/jpeg'
    if (documentPath.endsWith('.png')) {
      mimeType = 'image/png'
    } else if (documentPath.endsWith('.pdf')) {
      mimeType = 'application/pdf'
    }
    
    const prompt = `You are a medical document OCR assistant for the Veno Blood Donation Platform.
Analyze the provided medical report image.
Extract the following medical details:
1. Hemoglobin level (in g/dL, g/L, or similar - return as a numeric value in g/dL. For example, if it says 14.5 g/dL or 14.5 g/dl, return 14.5. If it says 145 g/L, convert it to 14.5).
2. Weight (in kg or lbs - return as a numeric value in kg. For example, if it says 70 kg, return 70. If not found, return null).
3. Date of the test or CBC report (strictly formatted as YYYY-MM-DD. If not found, return null).
4. Flagged medical conditions. Search the report for mention of any infectious diseases or conditions that could affect blood donation eligibility, such as: HIV, Hepatitis B, Hepatitis C, Tuberculosis (TB), Malaria, active infections, recent major surgery, cancer, pregnancy, active courses of antibiotics, or anticoagulants. Return them as a list of standardized uppercase strings (e.g., ["HIV", "HEPATITIS_B", "ACTIVE_ANTIBIOTICS"]). If none are found, return an empty array [].

Return ONLY a valid JSON object matching the following schema. Do NOT wrap it in markdown block like \`\`\`json, do NOT include extra comments, do NOT include anything other than the raw JSON:
{
  "hemoglobin": 14.5,
  "weight": 70.0,
  "last_cbc_date": "YYYY-MM-DD",
  "flagged_conditions": ["CONDITION_A", "CONDITION_B"]
}`

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Image
                }
              }
            ]
          }
        ]
      })
    })
    
    if (!response.ok) {
      const errorBody = await response.text()
      return new Response(
        JSON.stringify({ error: `Gemini API returned status ${response.status}: ${errorBody}` }), 
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const geminiResult = await response.json()
    const textResult = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text
    if (!textResult) {
      return new Response(
        JSON.stringify({ error: 'Gemini OCR extraction failed to find candidate text' }), 
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Clean text results
    const jsonStr = textResult.replace(/```json\s*|```/g, '').trim()
    let parsedData
    try {
      parsedData = JSON.parse(jsonStr)
    } catch (parseErr) {
      return new Response(
        JSON.stringify({ error: `Failed to parse Gemini output as JSON: ${textResult}` }), 
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: parsedData
      }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unexpected server error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } finally {
    // Crucial Privacy Step: delete raw uploaded document from Supabase Storage within 60 seconds
    if (documentPathToDelete && supabaseClientInstance) {
      try {
        await supabaseClientInstance
          .storage
          .from('identity-documents')
          .remove([documentPathToDelete]);
        console.log(`Successfully deleted temp medical file at ${documentPathToDelete}`);
      } catch (delErr) {
        console.error(`Failed to delete temp medical file at ${documentPathToDelete}:`, delErr);
      }
    }
  }
})
