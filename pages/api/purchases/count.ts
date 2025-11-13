import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { eventid } = req.query;
  if (!eventid) {
    return res.status(400).json({ error: 'eventid required' });
  }
  const { count, error } = await supabase
    .from('purchases')
    .select('buyer', { count: 'exact', head: true })
    .eq('eventid', eventid);
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ count });
}
