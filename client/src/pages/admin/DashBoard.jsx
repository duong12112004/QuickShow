import React, { startTransition, useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  CalendarDays,
  CircleDollarSign,
  Clapperboard,
  MessageSquareText,
  Popcorn,
  RotateCcw,
  Star,
  Ticket,
  TrendingUp,
  Users,
  Wallet
} from 'lucide-react'
import toast from 'react-hot-toast'
import Loading from '../../components/Loading'
import BlurCircle from '../../components/BlurCircle'
import { dateFormat } from '../../lib/dateFormat'
import { useAppContext } from '../../context/AppContext'

const RANGE_OPTIONS = [7, 14, 30]
const STATUS_COLORS = ['#22c55e', '#38bdf8', '#f97316', '#a78bfa', '#f84565', '#94a3b8', '#f59e0b']

const emptyDashboardData = {
  rangeDays: 7,
  totalBookings: 0,
  totalTickets: 0,
  totalRevenue: 0,
  grossRevenue: 0,
  netRevenue: 0,
  totalRefunds: 0,
  walletRefunds: 0,
  stripeRefunds: 0,
  refundPendingAmount: 0,
  activeShows: 0,
  totalUser: 0,
  revenueTrend: [],
  bookingStatusBreakdown: [],
  topMovies: [],
  reviews: {
    total: 0,
    visible: 0,
    hidden: 0,
    comments: 0,
    ratingOnly: 0,
    spoilers: 0,
    verified: 0,
    rated: 0,
    averageRating: 0,
    trend: []
  },
  concessions: {
    revenue: 0,
    ticketRevenue: 0,
    itemsSold: 0,
    bookings: 0,
    total: 0,
    active: 0,
    inactive: 0,
    topItems: []
  },
  upcomingShows: []
}

const formatCurrency = (value, currency) => `${Number(value || 0).toLocaleString('vi-VN')} ${currency}`
const formatCompactNumber = (value) => new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0)
const hasRevenueData = (items = []) => items.some((item) => (item.grossRevenue || item.netRevenue || item.refundAmount || item.bookings || item.tickets) > 0)
const hasPieData = (items = []) => items.some((item) => (item.value || 0) > 0)
const hasMovieData = (items = []) => items.some((item) => (item.netRevenue || item.tickets || item.grossRevenue) > 0)
const hasConcessionData = (items = []) => items.some((item) => (item.revenue || item.quantity) > 0)
const hasReviewTrendData = (items = []) => items.some((item) => (item.reviews || item.comments || item.hidden) > 0)

const useCountUp = (target, duration = 800) => {
  const [value, setValue] = useState(Number(target) || 0)

  useEffect(() => {
    const nextTarget = Number(target) || 0
    let frameId = 0
    let animationStart = 0
    const initialValue = value

    const tick = (timestamp) => {
      if (!animationStart) animationStart = timestamp
      const progress = Math.min((timestamp - animationStart) / duration, 1)
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(initialValue + (nextTarget - initialValue) * easedProgress))

      if (progress < 1) frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [target, duration])

  return value
}

const EmptyState = ({ text, minHeight = 'min-h-[240px]' }) => (
  <div className={`flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-center text-sm text-gray-400 ${minHeight}`}>
    {text}
  </div>
)

const SectionCard = ({ title, description, children, mounted, className = '' }) => (
  <section className={`rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm transition duration-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'} ${className}`}>
    <div className='mb-4'>
      <h2 className='text-lg font-semibold text-white'>{title}</h2>
      {description && <p className='mt-1 text-sm text-gray-400'>{description}</p>}
    </div>
    {children}
  </section>
)

const KpiCard = ({ icon: Icon, title, value, formatter = (current) => current.toLocaleString('vi-VN'), note, mounted, accentClass }) => {
  const animatedValue = useCountUp(value)

  return (
    <div className={`rounded-3xl border p-5 transition duration-300 hover:-translate-y-1 hover:border-primary/40 ${accentClass} ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
      <div className='flex items-start justify-between gap-4'>
        <div className='min-w-0'>
          <p className='text-sm text-gray-300'>{title}</p>
          <p className='mt-3 text-2xl font-semibold text-white'>{formatter(animatedValue)}</p>
          {note && <p className='mt-2 text-sm leading-5 text-gray-400'>{note}</p>}
        </div>
        <div className='rounded-2xl border border-white/10 bg-black/20 p-3'>
          {React.createElement(Icon, { className: 'h-5 w-5 text-white/80' })}
        </div>
      </div>
    </div>
  )
}

const RevenueTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null
  const data = payload[0]?.payload

  return (
    <div className='rounded-2xl border border-white/10 bg-[#111217]/95 p-3 text-sm shadow-xl'>
      <p className='font-medium text-white'>{label}</p>
      <p className='mt-2 text-gray-300'>Gộp: {formatCurrency(data?.grossRevenue, currency)}</p>
      <p className='text-gray-300'>Ròng: {formatCurrency(data?.netRevenue, currency)}</p>
      <p className='text-gray-300'>Hoàn tiền: {formatCurrency(data?.refundAmount, currency)}</p>
      <p className='mt-2 text-xs text-gray-400'>{data?.bookings || 0} booking • {data?.tickets || 0} vé</p>
    </div>
  )
}

const SimpleTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null

  return (
    <div className='rounded-2xl border border-white/10 bg-[#111217]/95 p-3 text-sm shadow-xl'>
      <p className='font-medium text-white'>{label || payload[0]?.payload?.name || payload[0]?.payload?.movieTitle}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className='mt-1 text-gray-300'>
          {item.name}: {item.dataKey?.toLowerCase?.().includes('revenue') ? formatCurrency(item.value, currency) : Number(item.value || 0).toLocaleString('vi-VN')}
        </p>
      ))}
    </div>
  )
}

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const data = payload[0]?.payload

  return (
    <div className='rounded-2xl border border-white/10 bg-[#111217]/95 p-3 text-sm shadow-xl'>
      <p className='font-medium text-white'>{data?.label}</p>
      <p className='mt-2 text-gray-300'>{data?.value || 0} booking</p>
    </div>
  )
}

const MiniMetric = ({ icon: Icon, label, value, className = '' }) => (
  <div className={`rounded-2xl border border-white/8 bg-black/20 p-4 ${className}`}>
    <div className='flex items-center gap-3'>
      {React.createElement(Icon, { className: 'h-5 w-5 text-white/75' })}
      <div>
        <p className='text-sm text-gray-400'>{label}</p>
        <p className='mt-1 text-xl font-semibold text-white'>{value}</p>
      </div>
    </div>
  </div>
)

const DashBoard = () => {
  const { axios, getToken, user, image_base_url } = useAppContext()
  const currency = import.meta.env.VITE_CURRENCY

  const [rangeDays, setRangeDays] = useState(7)
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dashboardData, setDashboardData] = useState(emptyDashboardData)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!user) return

    let ignore = false

    const fetchDashboardData = async () => {
      if (loading) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      try {
        const { data } = await axios.get('/api/admin/dashboard', {
          params: { rangeDays },
          headers: { Authorization: `Bearer ${await getToken()}` }
        })

        if (ignore) return

        if (data.success) {
          startTransition(() => {
            setDashboardData({ ...emptyDashboardData, ...data.dashboardData })
          })
        } else {
          toast.error(data.message)
        }
      } catch (error) {
        if (!ignore) toast.error('Lỗi khi tải dữ liệu tổng quan: ' + error.message)
      } finally {
        if (!ignore) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    fetchDashboardData()

    return () => {
      ignore = true
    }
  }, [axios, getToken, rangeDays, user])

  if (loading) return <Loading />

  const retentionRate = dashboardData.grossRevenue > 0
    ? Math.round((dashboardData.netRevenue / dashboardData.grossRevenue) * 100)
    : 0
  const concessionAttachRate = dashboardData.totalBookings > 0
    ? Math.round((dashboardData.concessions.bookings / dashboardData.totalBookings) * 100)
    : 0
  const commentRate = dashboardData.reviews.total > 0
    ? Math.round((dashboardData.reviews.comments / dashboardData.reviews.total) * 100)
    : 0

  return (
    <div className='relative pb-8'>
      <BlurCircle top='-110px' left='-40px' />
      <BlurCircle top='300px' left='78%' />

      <div className={`relative rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(248,69,101,0.18),_transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-6 transition duration-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
        <div className='flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between'>
          <div>
            <p className='text-sm uppercase tracking-[0.25em] text-primary/80'>Admin Dashboard</p>
            <h1 className='mt-3 text-3xl font-semibold text-white'>Tổng quan kinh doanh & vận hành</h1>
            <p className='mt-2 max-w-3xl text-sm leading-6 text-gray-300'>
              Doanh thu được thống kê theo ngày đặt vé trong {rangeDays} ngày gần nhất. Suất chiếu sắp tới, combo bắp nước và đánh giá/bình luận được tách riêng để dễ ra quyết định.
            </p>
          </div>

          <div className='flex flex-col items-start gap-3 xl:items-end'>
            <div className='inline-flex rounded-2xl border border-white/10 bg-black/20 p-1'>
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type='button'
                  onClick={() => setRangeDays(option)}
                  disabled={refreshing}
                  className={`rounded-xl px-4 py-2 text-sm transition ${rangeDays === option ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-300 hover:bg-white/8'} ${refreshing ? 'cursor-wait opacity-70' : ''}`}
                >
                  {option} ngày
                </button>
              ))}
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <div className='inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-gray-200'>
                <Users className='h-4 w-4 text-primary' />
                {dashboardData.totalUser.toLocaleString('vi-VN')} người dùng
              </div>
              {refreshing && (
                <div className='inline-flex rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-400'>
                  Đang cập nhật...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className='mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6'>
        <KpiCard
          icon={TrendingUp}
          title='Doanh thu ròng'
          value={dashboardData.netRevenue}
          formatter={(current) => formatCurrency(current, currency)}
          note={`Gộp ${formatCurrency(dashboardData.grossRevenue, currency)} • Giữ ${retentionRate}%`}
          mounted={mounted}
          accentClass='border-emerald-400/20 bg-emerald-500/10'
        />
        <KpiCard
          icon={Ticket}
          title='Booking / Vé'
          value={dashboardData.totalBookings}
          formatter={(current) => `${current.toLocaleString('vi-VN')} booking`}
          note={`${dashboardData.totalTickets.toLocaleString('vi-VN')} vé đã thanh toán`}
          mounted={mounted}
          accentClass='border-sky-400/20 bg-sky-500/10'
        />
        <KpiCard
          icon={Popcorn}
          title='Doanh thu combo'
          value={dashboardData.concessions.revenue}
          formatter={(current) => formatCurrency(current, currency)}
          note={`${dashboardData.concessions.itemsSold.toLocaleString('vi-VN')} món • Attach ${concessionAttachRate}%`}
          mounted={mounted}
          accentClass='border-amber-400/20 bg-amber-500/10'
        />
        <KpiCard
          icon={MessageSquareText}
          title='Đánh giá & bình luận'
          value={dashboardData.reviews.total}
          formatter={(current) => `${current.toLocaleString('vi-VN')} mục`}
          note={`${dashboardData.reviews.comments} bình luận • ${dashboardData.reviews.hidden} đã ẩn`}
          mounted={mounted}
          accentClass='border-violet-400/20 bg-violet-500/10'
        />
        <KpiCard
          icon={RotateCcw}
          title='Hoàn tiền'
          value={dashboardData.totalRefunds}
          formatter={(current) => formatCurrency(current, currency)}
          note={dashboardData.refundPendingAmount > 0 ? `Chờ hoàn ${formatCurrency(dashboardData.refundPendingAmount, currency)}` : 'Không có khoản chờ hoàn'}
          mounted={mounted}
          accentClass='border-rose-400/20 bg-rose-500/10'
        />
        <KpiCard
          icon={CalendarDays}
          title='Suất chiếu sắp tới'
          value={dashboardData.activeShows}
          formatter={(current) => `${current.toLocaleString('vi-VN')} suất`}
          note={`Trong ${rangeDays} ngày tới`}
          mounted={mounted}
          accentClass='border-cyan-400/20 bg-cyan-500/10'
        />
      </div>

      <div className='mt-6 grid gap-6 xl:grid-cols-[1.8fr_1fr]'>
        <SectionCard
          title='Doanh thu theo ngày đặt vé'
          description='Gom theo ngày booking được tạo, nên biểu đồ phản ánh nhịp bán vé thực tế từng ngày.'
          mounted={mounted}
        >
          {hasRevenueData(dashboardData.revenueTrend) ? (
            <div className='h-[360px]'>
              <ResponsiveContainer width='100%' height='100%'>
                <AreaChart data={dashboardData.revenueTrend} margin={{ top: 16, right: 18, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id='grossGradient' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='5%' stopColor='#f97316' stopOpacity={0.35} />
                      <stop offset='95%' stopColor='#f97316' stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id='netGradient' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='5%' stopColor='#22c55e' stopOpacity={0.35} />
                      <stop offset='95%' stopColor='#22c55e' stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id='refundGradient' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='5%' stopColor='#f84565' stopOpacity={0.25} />
                      <stop offset='95%' stopColor='#f84565' stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke='rgba(255,255,255,0.08)' vertical={false} />
                  <XAxis dataKey='label' tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatCompactNumber} tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip content={<RevenueTooltip currency={currency} />} cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeDasharray: '4 4' }} />
                  <Area type='monotone' dataKey='grossRevenue' stroke='#f97316' strokeWidth={2.2} fill='url(#grossGradient)' />
                  <Area type='monotone' dataKey='netRevenue' stroke='#22c55e' strokeWidth={2.4} fill='url(#netGradient)' />
                  <Area type='monotone' dataKey='refundAmount' stroke='#f84565' strokeWidth={2} fill='url(#refundGradient)' />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState text='Chưa có booking thanh toán trong khoảng thời gian này.' minHeight='min-h-[360px]' />
          )}
          <div className='mt-4 flex flex-wrap gap-3 text-sm text-gray-300'>
            <span className='inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-2'><span className='h-2.5 w-2.5 rounded-full bg-orange-400' />Gộp</span>
            <span className='inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-2'><span className='h-2.5 w-2.5 rounded-full bg-emerald-400' />Ròng</span>
            <span className='inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-2'><span className='h-2.5 w-2.5 rounded-full bg-primary' />Hoàn tiền</span>
          </div>
        </SectionCard>

        <SectionCard
          title='Cấu trúc doanh thu'
          description='Tách tiền vé, combo và hoàn tiền để nhìn rõ chất lượng doanh thu.'
          mounted={mounted}
        >
          <div className='grid gap-3'>
            <MiniMetric icon={CircleDollarSign} label='Tỷ lệ giữ doanh thu' value={`${retentionRate}%`} className='border-emerald-400/15 bg-emerald-500/8' />
            <MiniMetric icon={Ticket} label='Doanh thu vé' value={formatCurrency(dashboardData.concessions.ticketRevenue, currency)} className='border-sky-400/15 bg-sky-500/8' />
            <MiniMetric icon={Popcorn} label='Tỷ lệ booking có combo' value={`${concessionAttachRate}%`} className='border-amber-400/15 bg-amber-500/8' />
            <MiniMetric icon={Wallet} label='Hoàn vào ví' value={formatCurrency(dashboardData.walletRefunds, currency)} className='border-cyan-400/15 bg-cyan-500/8' />
          </div>
        </SectionCard>
      </div>

      <div className='mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]'>
        <SectionCard
          title='Top phim theo doanh thu'
          description='Xếp hạng theo doanh thu ròng trong khoảng ngày đặt vé.'
          mounted={mounted}
        >
          {hasMovieData(dashboardData.topMovies) ? (
            <div className='space-y-4'>
              <div className='h-[300px]'>
                <ResponsiveContainer width='100%' height='100%'>
                  <BarChart data={dashboardData.topMovies} margin={{ top: 16, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke='rgba(255,255,255,0.08)' vertical={false} />
                    <XAxis dataKey='movieTitle' tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} interval={0} height={60} />
                    <YAxis tickFormatter={formatCompactNumber} tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip content={<SimpleTooltip currency={currency} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey='netRevenue' name='Doanh thu ròng' fill='#f97316' radius={[8, 8, 0, 0]} maxBarSize={42} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className='grid gap-2'>
                {dashboardData.topMovies.map((movie) => (
                  <div key={movie.movieTitle} className='flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-sm'>
                    <div className='min-w-0'>
                      <p className='truncate font-medium text-white'>{movie.movieTitle}</p>
                      <p className='mt-1 text-xs text-gray-400'>{movie.tickets} vé • Hoàn {formatCurrency(movie.refundAmount, currency)}</p>
                    </div>
                    <p className='pl-4 font-semibold text-orange-300'>{formatCurrency(movie.netRevenue, currency)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState text='Chưa có dữ liệu phim trong khoảng thời gian này.' minHeight='min-h-[300px]' />
          )}
        </SectionCard>

        <SectionCard
          title='Combo bắp nước'
          description={`${dashboardData.concessions.active}/${dashboardData.concessions.total} món đang bán. Top món dựa trên booking đã thanh toán.`}
          mounted={mounted}
        >
          {hasConcessionData(dashboardData.concessions.topItems) ? (
            <div className='space-y-4'>
              <div className='h-[260px]'>
                <ResponsiveContainer width='100%' height='100%'>
                  <BarChart data={dashboardData.concessions.topItems} layout='vertical' margin={{ top: 8, right: 14, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke='rgba(255,255,255,0.08)' horizontal={false} />
                    <XAxis type='number' tickFormatter={formatCompactNumber} tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis type='category' dataKey='name' width={110} tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<SimpleTooltip currency={currency} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey='revenue' name='Doanh thu' fill='#f59e0b' radius={[0, 8, 8, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className='grid gap-2'>
                {dashboardData.concessions.topItems.map((item) => (
                  <div key={item.name} className='flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-sm'>
                    <div className='min-w-0'>
                      <p className='truncate font-medium text-white'>{item.name}</p>
                      <p className='mt-1 text-xs text-gray-400'>{item.category || 'Combo'} • {item.quantity} món</p>
                    </div>
                    <p className='pl-4 font-semibold text-amber-300'>{formatCurrency(item.revenue, currency)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState text='Chưa có combo được bán trong khoảng thời gian này.' minHeight='min-h-[300px]' />
          )}
        </SectionCard>
      </div>

      <div className='mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]'>
        <SectionCard
          title='Đánh giá & bình luận'
          description='Theo dõi phản hồi người dùng, bình luận cần kiểm duyệt và điểm trung bình.'
          mounted={mounted}
        >
          <div className='grid gap-3 sm:grid-cols-4'>
            <MiniMetric icon={Star} label='Điểm TB' value={dashboardData.reviews.averageRating ? `${dashboardData.reviews.averageRating}/10` : '-'} />
            <MiniMetric icon={MessageSquareText} label='Có bình luận' value={`${dashboardData.reviews.comments}`} />
            <MiniMetric icon={Users} label='Đã xem phim' value={`${dashboardData.reviews.verified}`} />
            <MiniMetric icon={RotateCcw} label='Đã ẩn' value={`${dashboardData.reviews.hidden}`} />
          </div>
          <div className='mt-4'>
            {hasReviewTrendData(dashboardData.reviews.trend) ? (
              <div className='h-[260px]'>
                <ResponsiveContainer width='100%' height='100%'>
                  <BarChart data={dashboardData.reviews.trend} margin={{ top: 16, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke='rgba(255,255,255,0.08)' vertical={false} />
                    <XAxis dataKey='label' tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} width={34} />
                    <Tooltip content={<SimpleTooltip currency={currency} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey='reviews' name='Tổng đánh giá' fill='#a78bfa' radius={[8, 8, 0, 0]} maxBarSize={28} />
                    <Bar dataKey='comments' name='Bình luận' fill='#38bdf8' radius={[8, 8, 0, 0]} maxBarSize={28} />
                    <Bar dataKey='hidden' name='Đã ẩn' fill='#f84565' radius={[8, 8, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text='Chưa có đánh giá hoặc bình luận trong khoảng thời gian này.' minHeight='min-h-[260px]' />
            )}
          </div>
          <div className='mt-4 rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-gray-300'>
            Tỷ lệ đánh giá có bình luận: <span className='font-semibold text-white'>{commentRate}%</span>
            {dashboardData.reviews.spoilers > 0 && <span> • Có {dashboardData.reviews.spoilers} bình luận spoiler</span>}
          </div>
        </SectionCard>

        <SectionCard
          title='Trạng thái booking'
          description='Tất cả booking tạo trong khoảng ngày đã chọn, bao gồm chưa thanh toán và đã hủy.'
          mounted={mounted}
        >
          {hasPieData(dashboardData.bookingStatusBreakdown) ? (
            <>
              <div className='h-[300px]'>
                <ResponsiveContainer width='100%' height='100%'>
                  <PieChart>
                    <Pie data={dashboardData.bookingStatusBreakdown} dataKey='value' nameKey='label' innerRadius={64} outerRadius={100} paddingAngle={3}>
                      {dashboardData.bookingStatusBreakdown.map((entry, index) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className='grid gap-2 sm:grid-cols-2'>
                {dashboardData.bookingStatusBreakdown.map((item, index) => (
                  <div key={item.status} className='flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-sm'>
                    <div className='flex min-w-0 items-center gap-2'>
                      <span className='h-2.5 w-2.5 shrink-0 rounded-full' style={{ backgroundColor: STATUS_COLORS[index % STATUS_COLORS.length] }} />
                      <span className='truncate text-gray-200'>{item.label}</span>
                    </div>
                    <span className='font-medium text-white'>{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState text='Chưa có booking trong khoảng thời gian này.' minHeight='min-h-[300px]' />
          )}
        </SectionCard>
      </div>

      <SectionCard
        title='Suất chiếu sắp tới'
        description='Theo dõi lịch vận hành trong các ngày tới, tách khỏi biểu đồ doanh thu theo ngày đặt vé.'
        mounted={mounted}
        className='mt-6'
      >
        {dashboardData.upcomingShows.length > 0 ? (
          <div className='grid gap-4'>
            {dashboardData.upcomingShows.map((show) => (
              <div key={show._id} className='flex flex-col gap-4 rounded-3xl border border-white/8 bg-black/20 p-4 transition duration-300 hover:-translate-y-1 hover:border-primary/40 md:flex-row md:items-center md:justify-between'>
                <div className='flex min-w-0 gap-4'>
                  {show.movie?.poster_path ? (
                    <img src={image_base_url + show.movie.poster_path} alt={show.movie?.title || 'Poster phim'} className='h-28 w-20 rounded-2xl object-cover' />
                  ) : (
                    <div className='flex h-28 w-20 items-center justify-center rounded-2xl bg-white/8 text-xs text-gray-400'>No poster</div>
                  )}
                  <div className='min-w-0'>
                    <p className='line-clamp-2 text-lg font-semibold text-white'>{show.movie?.title || 'Chưa có tên phim'}</p>
                    <div className='mt-2 flex flex-wrap gap-2 text-sm text-gray-300'>
                      <span className='rounded-full bg-white/6 px-3 py-1'>{show.room?.name || 'Chưa có phòng'}</span>
                      <span className='rounded-full bg-white/6 px-3 py-1'>{dateFormat(show.showDateTime)}</span>
                      <span className='rounded-full bg-white/6 px-3 py-1'>{formatCurrency(show.basePrice, currency)}</span>
                    </div>
                    <p className='mt-3 text-sm text-gray-400'>Ghế bán {show.soldSeatCount || 0} • Ghế giữ {show.heldSeatCount || 0}</p>
                  </div>
                </div>
                <div className='grid gap-3 md:min-w-[240px] md:grid-cols-2'>
                  <div className='rounded-2xl border border-emerald-400/15 bg-emerald-500/10 px-4 py-3'>
                    <p className='text-xs uppercase tracking-[0.2em] text-emerald-200/80'>Đã thu</p>
                    <p className='mt-2 text-lg font-semibold text-white'>{formatCurrency(show.totalEarnings, currency)}</p>
                  </div>
                  <div className='rounded-2xl border border-sky-400/15 bg-sky-500/10 px-4 py-3'>
                    <p className='text-xs uppercase tracking-[0.2em] text-sky-100/80'>Ghế</p>
                    <p className='mt-2 text-lg font-semibold text-white'>{show.soldSeatCount || 0} bán / {show.heldSeatCount || 0} giữ</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text='Không có suất chiếu sắp tới trong phạm vi đã chọn.' minHeight='min-h-[220px]' />
        )}
      </SectionCard>
    </div>
  )
}

export default DashBoard
