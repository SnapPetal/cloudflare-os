import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { CalendarCheck, Clock, Tag, Trash, XCircle } from '@phosphor-icons/react'
import { useKumoToastManager } from '@cloudflare/kumo'

type BookingType = { id: number; name: string; description: string; durationMinutes: number; bufferMinutes: number; active: boolean; color: string }
type Booking = { id: number; confirmationCode: string; bookingType: BookingType; attendeeName: string; attendeeEmail: string; attendeePhone: string | null; startTime: string; endTime: string; message: string | null; status: string }
type Slot = { id: number; startTime: string; endTime: string; available: boolean }
type Snapshot = { bookingTypes: BookingType[]; bookings: Booking[]; availabilitySlots: Slot[] }

const API = '/api/booking-admin'
const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const statusColor = (status: string) => status === 'CONFIRMED' ? 'text-kumo-success' : status === 'CANCELLED' ? 'text-kumo-danger' : 'text-kumo-subtle'

export default function BookingAdminPanel() {
  const toasts = useKumoToastManager()
  const toastsRef = useRef(toasts)
  const [data, setData] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try { const response = await fetch(`${API}/snapshot`); if (!response.ok) throw new Error(`Booking service returned ${response.status}`); setData(await response.json() as Snapshot) }
    catch (error) { toastsRef.current.add({ title: error instanceof Error ? error.message : 'Failed to load bookings', variant: 'error' }) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const mutate = async (key: string, request: () => Promise<Response>, success: string) => {
    setBusy(key)
    try { const response = await request(); if (!response.ok) throw new Error(`Booking service returned ${response.status}`); await load(); toastsRef.current.add({ title: success, variant: 'success' }) }
    catch (error) { toastsRef.current.add({ title: error instanceof Error ? error.message : 'Booking update failed', variant: 'error' }) }
    finally { setBusy(null) }
  }
  const cancel = (id: number) => { if (window.confirm('Cancel this booking?')) void mutate(`cancel-${id}`, () => fetch(`${API}/bookings/${id}/cancel`, { method: 'POST' }), 'Booking cancelled') }
  const addSlot = async (event: FormEvent) => { event.preventDefault(); await mutate('add-slot', () => fetch(`${API}/availability`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startTime: start, endTime: end }) }), 'Availability added'); setStart(''); setEnd('') }
  const removeSlot = (id: number) => { if (window.confirm('Delete this availability slot?')) void mutate(`delete-slot-${id}`, () => fetch(`${API}/availability/${id}`, { method: 'DELETE' }), 'Availability deleted') }
  if (loading && !data) return <p className="text-sm text-kumo-subtle">Loading booking operations...</p>
  if (!data) return <button className="text-sm text-kumo-brand underline" onClick={() => void load()}>Try again</button>
  return <div className="space-y-6">
    <div><h2 className="text-lg font-semibold text-kumo-strong">Booking Operations</h2><p className="text-sm text-kumo-subtle mt-1">Manage bookings and availability from the private Cloudflare OS control plane.</p></div>
    <section className="bg-kumo-elevated border border-kumo-line rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-kumo-line"><CalendarCheck size={20} className="text-kumo-subtle" /><h3 className="font-medium text-kumo-strong">Bookings ({data.bookings.length})</h3></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-kumo-subtle border-b border-kumo-line"><tr><th className="px-5 py-3">Attendee</th><th className="px-5 py-3">Meeting</th><th className="px-5 py-3">When</th><th className="px-5 py-3">Status</th><th /></tr></thead><tbody>
        {data.bookings.map((booking) => <tr key={booking.id} className="border-b border-kumo-line last:border-0"><td className="px-5 py-3"><div className="text-kumo-strong">{booking.attendeeName}</div><div className="text-xs text-kumo-subtle">{booking.attendeeEmail}</div></td><td className="px-5 py-3 text-kumo-default">{booking.bookingType.name}<div className="text-xs text-kumo-subtle">{booking.confirmationCode}</div></td><td className="px-5 py-3 text-kumo-default">{date(booking.startTime)}</td><td className={`px-5 py-3 font-medium ${statusColor(booking.status)}`}>{booking.status}</td><td className="px-5 py-3 text-right">{booking.status === 'CONFIRMED' && <button className="inline-flex items-center gap-1 text-kumo-danger hover:underline disabled:opacity-50" disabled={busy === `cancel-${booking.id}`} onClick={() => cancel(booking.id)}><XCircle size={15} />Cancel</button>}</td></tr>)}
        {!data.bookings.length && <tr><td colSpan={5} className="px-5 py-8 text-center text-kumo-subtle">No bookings yet</td></tr>}
      </tbody></table></div>
    </section>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="bg-kumo-elevated border border-kumo-line rounded-xl p-5"><div className="flex items-center gap-3 mb-4"><Clock size={20} className="text-kumo-subtle" /><h3 className="font-medium text-kumo-strong">Add Availability</h3></div><form className="space-y-3" onSubmit={addSlot}><label className="block text-sm text-kumo-default">Start<input required type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full rounded-lg border border-kumo-line bg-kumo-base px-3 py-2 text-sm" /></label><label className="block text-sm text-kumo-default">End<input required type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 w-full rounded-lg border border-kumo-line bg-kumo-base px-3 py-2 text-sm" /></label><button type="submit" disabled={busy === 'add-slot'} className="rounded-lg bg-kumo-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Add slot</button></form></section>
      <section className="bg-kumo-elevated border border-kumo-line rounded-xl p-5"><div className="flex items-center gap-3 mb-4"><Clock size={20} className="text-kumo-subtle" /><h3 className="font-medium text-kumo-strong">Availability ({data.availabilitySlots.length})</h3></div><div className="space-y-2 max-h-80 overflow-y-auto">{data.availabilitySlots.map((slot) => <div key={slot.id} className="flex items-center justify-between gap-3 rounded-lg border border-kumo-line px-3 py-2"><div className="text-sm text-kumo-default">{date(slot.startTime)}<div className="text-xs text-kumo-subtle">to {date(slot.endTime)}</div></div><button aria-label="Delete availability" className="text-kumo-danger disabled:opacity-50" disabled={busy === `delete-slot-${slot.id}`} onClick={() => removeSlot(slot.id)}><Trash size={16} /></button></div>)}{!data.availabilitySlots.length && <p className="text-sm text-kumo-subtle">No availability configured.</p>}</div></section>
    </div>
    <section className="bg-kumo-elevated border border-kumo-line rounded-xl p-5"><div className="flex items-center gap-3 mb-4"><Tag size={20} className="text-kumo-subtle" /><h3 className="font-medium text-kumo-strong">Booking Types</h3></div><div className="grid gap-3 sm:grid-cols-2">{data.bookingTypes.map((type) => <div key={type.id} className="rounded-lg border border-kumo-line px-3 py-3"><div className="flex items-center gap-2 text-sm font-medium text-kumo-strong"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: type.color }} />{type.name}</div><p className="text-xs text-kumo-subtle mt-1">{type.durationMinutes} min · {type.active ? 'Active' : 'Inactive'}</p></div>)}</div></section>
  </div>
}
