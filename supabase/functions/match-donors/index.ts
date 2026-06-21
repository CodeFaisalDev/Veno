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
    
    // Initialize Supabase Client with Service Role (bypass RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Database environment variables are missing' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)
    
    // Verify user session JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized session or token expired' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const { requestId } = await req.json()
    if (!requestId) {
      return new Response(
        JSON.stringify({ error: 'Missing requestId in request body' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // 1. Fetch blood request details
    const { data: request, error: requestErr } = await supabaseClient
      .from('blood_requests')
      .select('id, patient_blood_group, location_address, urgency, units_needed, requester_id')
      .eq('id', requestId)
      .single()
      
    if (requestErr || !request) {
      return new Response(
        JSON.stringify({ error: `Request details not found: ${requestErr?.message || 'Empty data'}` }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // 2. Fetch nearby compatible donors via PostGIS database RPC helper
    const { data: donors, error: rpcError } = await supabaseClient
      .rpc('find_compatible_nearby_donors', { p_request_id: requestId })
      
    if (rpcError) {
      return new Response(
        JSON.stringify({ error: `Geofence database RPC lookup failed: ${rpcError.message}` }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!donors || donors.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No compatible donors found within radius.', ranked_donors: [] }), 
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // 3. Score & Rank matched candidates using Gemini Flash model
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key is not configured in environment' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`
    
    const prompt = `You are an AI-driven blood donor ranking assistant for the Veno platform.
You are given a list of nearby compatible donors and a blood request.
Rank the donors using the following weights:
- Distance (40% weight): Closer donors (smaller distance_meters) are strongly preferred.
- Donation History/Reliability (30% weight): Donors with higher completed donation count (total_donations) and more points are preferred.
- Health Profile Suitability (20% weight): Donors with higher hemoglobin levels (if provided) and optimal weights are preferred.
- Response Rate (10% weight): Donors with a higher historical acceptance rate (response_rate) of requests are preferred.

Blood Request Details:
- Urgency: ${request.urgency}
- Required Blood Group: ${request.patient_blood_group}
- Units Needed: ${request.units_needed}

Donor Candidate List (in JSON format):
${JSON.stringify(donors.map((d: any) => ({
  donor_id: d.donor_id,
  blood_group: d.blood_group,
  distance_meters: d.distance_meters,
  total_donations: d.total_donations,
  response_rate: d.response_rate,
  points: d.points,
  hemoglobin: d.hemoglobin,
  weight: d.weight,
  last_cbc_date: d.last_cbc_date
})))}

Based on these parameters, rank the donors.
Return ONLY a valid JSON object matching the following schema. The JSON object should contain a single key "ranked_donor_ids" which maps to an array of ranked donor UUID strings, from highest rank to lowest rank.
Do NOT wrap it in markdown block like \`\`\`json, do NOT include extra comments, do NOT include anything other than the raw JSON:
{
  "ranked_donor_ids": ["uuid-1", "uuid-2", ...]
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
              { text: prompt }
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
        JSON.stringify({ error: 'Gemini AI ranking failed to return candidates' }), 
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Clean text results
    const jsonStr = textResult.replace(/```json\s*|```/g, '').trim()
    let parsedRankings
    try {
      parsedRankings = JSON.parse(jsonStr)
    } catch (parseErr) {
      return new Response(
        JSON.stringify({ error: `Failed to parse Gemini ranking output as JSON: ${textResult}` }), 
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const rankedIds = parsedRankings.ranked_donor_ids || []
    
    // Select top 20 ranked donors (or all if fewer)
    const targetDonors = rankedIds.slice(0, 20)
    
    // 4. Register queue entries and update statuses in database
    if (targetDonors.length > 0) {
      // Create request_queues entries
      const queueEntries = targetDonors.map((donorId: string) => {
        const donor = donors.find((d: any) => d.donor_id === donorId)
        return {
          request_id: requestId,
          donor_id: donorId,
          status: 'PENDING',
          // location_coords coordinates format will be automatically cast if sent as object
          location_coords: donor ? donor.location_coords : null
        }
      })
      
      const { error: queueErr } = await supabaseClient
        .from('request_queues')
        .insert(queueEntries)
        
      if (queueErr) {
        console.error('Error inserting into request_queues:', queueErr)
      }
      
      // Update matching donors status to REQUEST_PENDING
      const { error: statusErr } = await supabaseClient
        .from('donor_statuses')
        .update({ state: 'REQUEST_PENDING', updated_at: new Date().toISOString() })
        .in('user_id', targetDonors)
        .eq('state', 'ACTIVE')
        
      if (statusErr) {
        console.error('Error updating matching donor statuses:', statusErr)
      }
    }
    
    // 5. Broadcast Push Notifications using Expo Push API
    const pushMessages = []
    for (const donorId of targetDonors) {
      const donor = donors.find((d: any) => d.donor_id === donorId)
      if (donor && donor.push_token && donor.push_token.startsWith('ExponentPushToken')) {
        pushMessages.push({
          to: donor.push_token,
          sound: 'default',
          title: request.urgency === 'CRITICAL' ? '🚨 CRITICAL Blood Needed Nearby' : '🩸 Blood Needed Nearby',
          body: `${request.patient_blood_group} blood requested at ${request.location_address}. Tap to respond.`,
          data: { requestId: request.id },
          priority: request.urgency === 'CRITICAL' ? 'high' : 'normal',
        })
      }
    }
    
    if (pushMessages.length > 0) {
      const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pushMessages)
      })
      
      if (!pushResponse.ok) {
        console.error(`Expo Push Notification broadcast failed: ${await pushResponse.text()}`)
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully matched, queued and notified ${targetDonors.length} compatible donors.`,
        notified_donor_ids: targetDonors
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
