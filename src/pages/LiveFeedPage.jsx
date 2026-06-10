import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import LiveFeed from '../components/LiveFeed.jsx'
import { supabase } from '../lib/supabase.js'
import { useEffect, useState } from 'react'

export default function LiveFeedPage() {
  const { id } = useParams()
  const [siteName, setSiteName] = useState('')

  useEffect(() => {
    supabase.from('sites').select('name').eq('id', id).single().then(({ data }) => {
      setSiteName(data?.name || '')
    })
  }, [id])

  return (
    <Layout variant="admin">
      <Link to={`/admin/site/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to site
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Live Feed — {siteName}</h1>
      <LiveFeed siteId={id} limit={50} />
    </Layout>
  )
}
