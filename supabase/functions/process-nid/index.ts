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
  
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Initialize Supabase Client with Service Role (bypass user RLS constraints for verification update)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Database environment variables are missing' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)
    
    // Verify user identity using user session JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized session or token expired' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const { documentPath, documentType } = await req.json()
    if (!documentPath) {
      return new Response(
        JSON.stringify({ error: 'Missing documentPath in request body' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // 1. Download image from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseClient
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
    
    const prompt = `You are an OCR and identity verification assistant for Veno Blood Donation Platform.
Analyze the provided document (type: ${documentType || 'Bangladesh NID'}).
Extract the following fields from the document:
1. Legal full name
2. Date of birth (strictly formatted as YYYY-MM-DD)

Important formatting rules:
- Names should be extracted in full (including middle names if present).
- Date of birth must be returned in the ISO format (YYYY-MM-DD). If it is in DD/MM/YYYY, convert it to YYYY-MM-DD.

Return ONLY a valid JSON object matching the following schema. Do NOT wrap it in markdown block like \`\`\`json, do NOT include extra comments, do NOT include anything other than the raw JSON:
{
  "full_name": "extracted full name",
  "date_of_birth": "YYYY-MM-DD"
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
    
    // Clean text results (sometimes LLM wraps JSON in ```json ... ``` despite instructions)
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
    
    const extractedName = parsedData.full_name?.trim()
    const extractedDob = parsedData.date_of_birth?.trim()
    
    if (!extractedName || !extractedDob) {
      return new Response(
        JSON.stringify({ 
          error: `Incomplete fields extracted from document. Extracted: ${JSON.stringify(parsedData)}` 
        }), 
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // 4. Retrieve user's profiles record
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('full_name, date_of_birth')
      .eq('id', user.id)
      .single()
      
    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found in profiles database table' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Compare date of birth exactly
    if (profile.date_of_birth !== extractedDob) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          errorType: 'DOB_MISMATCH',
          message: `Date of birth on document (${extractedDob}) does not match your registered profile (${profile.date_of_birth}).` 
        }), 
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Compare names case-insensitively and fuzzy-matching
    const cleanProfileName = profile.full_name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
    const cleanExtractedName = extractedName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
    
    const profileTokens = cleanProfileName.split(/\s+/)
    const extractedTokens = cleanExtractedName.split(/\s+/)
    const overlap = profileTokens.filter((token: string) => extractedTokens.includes(token))
    
    // Calculate Jaccard similarity between name tokens
    const similarity = overlap.length / Math.max(profileTokens.length, extractedTokens.length)
    
    // Minimum 60% similarity required (handles minor spelling differences or missing middle names)
    if (similarity < 0.6) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          errorType: 'NAME_MISMATCH',
          message: `Name on document (${extractedName}) does not match your registered profile (${profile.full_name}).` 
        }), 
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // 5. Success: update profile badge and role
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ 
        verification_badge: true,
        role: 'VERIFIED_USER'
      })
      .eq('id', user.id)
      
    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Failed to update profile verification status: ${updateError.message}` }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Identity successfully verified! Verification badge awarded.' 
      }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unexpected server error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
