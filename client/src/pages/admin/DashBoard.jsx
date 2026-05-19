import React, { startTransition, useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  CalendarDays,
  CircleDollarSign,
  Ticket,
  Users,
  RotateCcw,
  Wallet,
  TrendingUp,
  Clapperboard
} from 'lucide-react'
import Loading from '../../components/Loading'
import BlurCircle from '../../components/BlurCircle'
import { dateFormat } from '../../lib/dateFormat'
import toast from 'react-hot-toast'
import { useAppContext } from '../../context/AppContext'

const RANGE_OPTIONS = [7, 14, 30]
const STATUS_COLORS = ['#f84565', '#f59e0b', '#38bdf8', '#22c55e', '#a78bfa', '#fb7185']

const formatCurrency = (value, currency) => `${Number(value || 0).toLocaleString('vi-VN')} ${currency}`
const formatCompactNumber = (value) => new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0)
const hasRevenueData = (items = []) => items.some((item) => (item.grossRevenue || item.netRevenue || item.refundAmount || item.bookings || item.tickets) > 0)
const hasPieData = (items = []) => items.some((item) => (item.value || 0) > 0)
const hasMovieData = (items = []) => items.some((item) => (item.netRevenue || item.tickets || item.grossRevenue) > 0)

const useCountUp = (target, duration = 900) => {
  const [value, setValue] = useState(Number(target) || 0)

  useEffect(() => {
    const nextTarget = Number(target) || 0
    let frameId = 0
    let animationStart = 0
    const initialValue = value

    const tick = (timestamp) => {
      if (!animationStart) {
        animationStart = timestamp
      }

      const progress = Math.min((timestamp - animationStart) / duration, 1)
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      const nextValue = Math.round(initialValue + (nextTarget - initialValue) * easedProgress)
      setValue(nextValue)

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick)
      }
    }

    frameId = window.requestAnimationFrame(tick)

    return () => window.cancelAnimationFrame(frameId)
  }, [target, duration])

  return value
}

const EmptyState = ({ text, minHeight = 'min-h-[240px]' }) => (
  <div className={`flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm text-gray-400 ${minHeight}`}>
    {text}
  </div>
)

const SectionCard = ({ title, description, children, mounted, className = '' }) => (
  <section
    className={`rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm transition duration-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'} ${className}`}
  >
    <div className='mb-4 flex items-start justify-between gap-3'>
      <div>
        <h2 className='text-lg font-semibold text-white'>{title}</h2>
        {description ? <p className='mt-1 text-sm text-gray-400'>{description}</p> : null}
      </div>
    </div>
    {children}
  </section>
)

const KpiCard = ({
  icon: Icon,
  title,
  value,
  formatter = (current) => current.toLocaleString('vi-VN'),
  note,
  mounted,
  accentClass
}) => {
  const animatedValue = useCountUp(value)

  return (
    <div
      className={`rounded-3xl border p-5 transition duration-300 hover:-translate-y-1 hover:border-primary/40 ${accentClass} ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
    >
      <div className='flex items-start justify-between gap-4'>
        <div>
          <p className='text-sm text-gray-300'>{title}</p>
          <p className='mt-3 text-2xl font-semibold text-white'>{formatter(animatedValue)}</p>
          {note ? <p className='mt-2 text-sm text-gray-400'>{note}</p> : null}
        </div>
        <div className='rounded-2xl border border-white/10 bg-black/20 p-3'>
          <Icon className='h-5 w-5 text-white/80' />
        </div>
      </div>
    </div>
  )
}

const RevenueTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) {
    return null
  }

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

const MoviesTooltip = ({ active, payload, currency }) => {
  if (!active || !payload?.length) {
    return null
  }

  const data = payload[0]?.payload

  return (
    <div className='rounded-2xl border border-white/10 bg-[#111217]/95 p-3 text-sm shadow-xl'>
      <p className='font-medium text-white'>{data?.movieTitle}</p>
      <p className='mt-2 text-gray-300'>Ròng: {formatCurrency(data?.netRevenue, currency)}</p>
      <p className='text-gray-300'>Gộp: {formatCurrency(data?.grossRevenue, currency)}</p>
      <p className='text-gray-300'>Hoàn tiền: {formatCurrency(data?.refundAmount, currency)}</p>
      <p className='mt-2 text-xs text-gray-400'>{data?.tickets || 0} vé</p>
    </div>
  )
}

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) {
    return null
  }

  const data = payload[0]?.payload

  return (
    <div className='rounded-2xl border border-white/10 bg-[#111217]/95 p-3 text-sm shadow-xl'>
      <p className='font-medium text-white'>{data?.label}</p>
      <p className='mt-2 text-gray-300'>{data?.value || 0} booking</p>
    </div>
  )
}

const DashBoard = () => {
  const { axios, getToken, user, image_base_url } = useAppContext()
  const currency = import.meta.env.VITE_CURRENCY

  const [rangeDays, setRangeDays] = useState(7)
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dashboardData, setDashboardData] = useState({
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
    upcomingShows: []
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!user) {
      return
    }

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

        if (ignore) {
          return
        }

        if (data.success) {
          startTransition(() => {
            setDashboardData(data.dashboardData)
          })
        } else {
          toast.error(data.message)
        }
      } catch (error) {
        if (!ignore) {
          toast.error('Lỗi khi tải dữ liệu tổng quan: ' + error.message)
        }
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

  if (loading) {
    return <Loading />
  }

  return (
    <div className='relative pb-8'>
      <BlurCircle top='-110px' left='-40px' />
      <BlurCircle top='260px' left='78%' />

      <div className={`relative rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(248,69,101,0.18),_transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 transition duration-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
        <div className='flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between'>
          <div>
            <p className='text-sm uppercase tracking-[0.25em] text-primary/80'>Admin Dashboard</p>
            <h1 className='mt-3 text-3xl font-semibold text-white'>Tổng quan hệ thống</h1>
            <p className='mt-2 max-w-2xl text-sm text-gray-300'>
              Theo ngày suất chiếu từ hôm nay đến {rangeDays} ngày tới, phản ánh trực tiếp doanh thu gộp, hoàn tiền và vận hành suất chiếu.
            </p>
          </div>

          <div className='flex flex-col items-start gap-3 lg:items-end'>
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

              {dashboardData.refundPendingAmount > 0 ? (
                <div className='inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100'>
                  <RotateCcw className='h-4 w-4' />
                  Chờ hoàn: {formatCurrency(dashboardData.refundPendingAmount, currency)}
                </div>
              ) : null}

              {refreshing ? (
                <div className='inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-400'>
                  Đang cập nhật...
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className='mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5'>
        <KpiCard
          icon={TrendingUp}
          title='Doanh thu ròng'
          value={dashboardData.netRevenue}
          formatter={(current) => formatCurrency(current, currency)}
          note={`Gộp ${formatCurrency(dashboardData.grossRevenue, currency)} • Hoàn ${formatCurrency(dashboardData.totalRefunds, currency)}`}
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
          icon={RotateCcw}
          title='Tổng hoàn tiền'
          value={dashboardData.totalRefunds}
          formatter={(current) => formatCurrency(current, currency)}
          note={`Ví ${formatCurrency(dashboardData.walletRefunds, currency)}${dashboardData.stripeRefunds > 0 ? ` • Stripe cũ ${formatCurrency(dashboardData.stripeRefunds, currency)}` : ''}`}
          mounted={mounted}
          accentClass='border-rose-400/20 bg-rose-500/10'
        />
        <KpiCard
          icon={Wallet}
          title='Hoàn vào ví'
          value={dashboardData.walletRefunds}
          formatter={(current) => formatCurrency(current, currency)}
          note={dashboardData.stripeRefunds > 0 ? `Dữ liệu Stripe cũ: ${formatCurrency(dashboardData.stripeRefunds, currency)}` : 'Luồng hoàn tiền hiện tại ưu tiên ví QuickShow'}
          mounted={mounted}
          accentClass='border-cyan-400/20 bg-cyan-500/10'
        />
        <KpiCard
          icon={CalendarDays}
          title='Suất chiếu sắp tới'
          value={dashboardData.activeShows}
          formatter={(current) => `${current.toLocaleString('vi-VN')} suất`}
          note='Trong phạm vi ngày đang chọn'
          mounted={mounted}
          accentClass='border-amber-400/20 bg-amber-500/10'
        />
      </div>

      <div className='mt-6 grid gap-6 xl:grid-cols-[1.8fr_1fr]'>
        <SectionCard
          title='Doanh thu theo ngày suất chiếu'
          description='Gross revenue, net revenue và tổng hoàn tiền theo ngày showtime.'
          mounted={mounted}
          className='animate-[fadeIn_0.35s_ease-out]'
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
                      <stop offset='5%' stopColor='#f84565' stopOpacity={0.24} />
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
            <EmptyState text='Chưa có dữ liệu trong khoảng thời gian này.' minHeight='min-h-[360px]' />
          )}

          <div className='mt-4 flex flex-wrap gap-3 text-sm text-gray-300'>
            <div className='inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-2'>
              <span className='h-2.5 w-2.5 rounded-full bg-orange-400' />
              Doanh thu gộp
            </div>
            <div className='inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-2'>
              <span className='h-2.5 w-2.5 rounded-full bg-emerald-400' />
              Doanh thu ròng
            </div>
            <div className='inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-2'>
              <span className='h-2.5 w-2.5 rounded-full bg-primary' />
              Hoàn tiền đã xử lý
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title='Trạng thái booking'
          description='Tỷ trọng booking đã thanh toán trong phạm vi showtime đang theo dõi.'
          mounted={mounted}
          className='animate-[fadeIn_0.35s_ease-out]'
        >
          {hasPieData(dashboardData.bookingStatusBreakdown) ? (
            <>
              <div className='h-[360px]'>
                <ResponsiveContainer width='100%' height='100%'>
                  <PieChart>
                    <Pie
                      data={dashboardData.bookingStatusBreakdown}
                      dataKey='value'
                      nameKey='label'
                      innerRadius={72}
                      outerRadius={108}
                      paddingAngle={3}
                    >
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
                    <div className='flex items-center gap-2'>
                      <span className='h-2.5 w-2.5 rounded-full' style={{ backgroundColor: STATUS_COLORS[index % STATUS_COLORS.length] }} />
                      <span className='text-gray-200'>{item.label}</span>
                    </div>
                    <span className='font-medium text-white'>{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState text='Chưa có dữ liệu trong khoảng thời gian này.' minHeight='min-h-[360px]' />
          )}
        </SectionCard>
      </div>

      <div className='mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]'>
        <SectionCard
          title='Top phim theo doanh thu'
          description='Ưu tiên doanh thu ròng, vẫn theo dõi số vé để nhìn ra phim kéo traffic.'
          mounted={mounted}
          className='animate-[fadeIn_0.35s_ease-out]'
        >
          {hasMovieData(dashboardData.topMovies) ? (
            <>
              <div className='h-[320px]'>
                <ResponsiveContainer width='100%' height='100%'>
                  <BarChart data={dashboardData.topMovies} margin={{ top: 16, right: 8, left: -10, bottom: 0 }} barGap={10}>
                    <CartesianGrid stroke='rgba(255,255,255,0.08)' vertical={false} />
                    <XAxis dataKey='movieTitle' tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} interval={0} height={56} />
                    <YAxis yAxisId='money' tickFormatter={formatCompactNumber} tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
                    <YAxis yAxisId='tickets' hide />
                    <Tooltip content={<MoviesTooltip currency={currency} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar yAxisId='money' dataKey='netRevenue' fill='#f97316' radius={[8, 8, 0, 0]} maxBarSize={40} />
                    <Bar yAxisId='tickets' dataKey='tickets' fill='#38bdf8' radius={[8, 8, 0, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className='mt-4 grid gap-2'>
                {dashboardData.topMovies.map((movie) => (
                  <div key={movie.movieTitle} className='flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-sm'>
                    <div className='min-w-0'>
                      <p className='truncate font-medium text-white'>{movie.movieTitle}</p>
                      <p className='mt-1 text-xs text-gray-400'>{movie.tickets} vé • Hoàn {formatCurrency(movie.refundAmount, currency)}</p>
                    </div>
                    <p className='pl-4 font-medium text-orange-300'>{formatCurrency(movie.netRevenue, currency)}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState text='Chưa có dữ liệu trong khoảng thời gian này.' minHeight='min-h-[320px]' />
          )}
        </SectionCard>

        <SectionCard
          title='Tín hiệu nhanh'
          description='Nhìn nhanh độ bền doanh thu và cấu trúc hoàn tiền trong phạm vi đã chọn.'
          mounted={mounted}
          className='animate-[fadeIn_0.35s_ease-out]'
        >
          <div className='grid gap-3'>
            <div className='rounded-2xl border border-white/8 bg-black/20 p-4'>
              <div className='flex items-center gap-3'>
                <CircleDollarSign className='h-5 w-5 text-emerald-400' />
                <div>
                  <p className='text-sm text-gray-400'>Tỷ lệ giữ doanh thu</p>
                  <p className='mt-1 text-xl font-semibold text-white'>
                    {dashboardData.grossRevenue > 0
                      ? `${Math.round((dashboardData.netRevenue / dashboardData.grossRevenue) * 100)}%`
                      : '0%'}
                  </p>
                </div>
              </div>
            </div>

            <div className='rounded-2xl border border-white/8 bg-black/20 p-4'>
              <div className='flex items-center gap-3'>
                <Wallet className='h-5 w-5 text-cyan-400' />
                <div>
                  <p className='text-sm text-gray-400'>Hoàn vào ví / tổng hoàn</p>
                  <p className='mt-1 text-xl font-semibold text-white'>
                    {dashboardData.totalRefunds > 0
                      ? `${Math.round((dashboardData.walletRefunds / dashboardData.totalRefunds) * 100)}%`
                      : '0%'}
                  </p>
                </div>
              </div>
            </div>

            <div className='rounded-2xl border border-white/8 bg-black/20 p-4'>
              <div className='flex items-center gap-3'>
                <Clapperboard className='h-5 w-5 text-amber-400' />
                <div>
                  <p className='text-sm text-gray-400'>Booking trung bình mỗi ngày</p>
                  <p className='mt-1 text-xl font-semibold text-white'>
                    {(dashboardData.totalBookings / rangeDays).toFixed(1)}
                  </p>
                </div>
              </div>
            </div>

            <div className='rounded-2xl border border-white/8 bg-black/20 p-4'>
              <div className='flex items-center gap-3'>
                <RotateCcw className='h-5 w-5 text-primary' />
                <div>
                  <p className='text-sm text-gray-400'>Refund pending</p>
                  <p className='mt-1 text-xl font-semibold text-white'>{formatCurrency(dashboardData.refundPendingAmount, currency)}</p>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title='Suất chiếu sắp tới'
        description='Theo dõi phòng chiếu, giá vé, lượng ghế bán và tổng tiền booking đã thanh toán cho từng suất.'
        mounted={mounted}
        className='mt-6 animate-[fadeIn_0.35s_ease-out]'
      >
        {dashboardData.upcomingShows.length > 0 ? (
          <div className='grid gap-4'>
            {dashboardData.upcomingShows.map((show) => (
              <div key={show._id} className='flex flex-col gap-4 rounded-3xl border border-white/8 bg-black/20 p-4 transition duration-300 hover:-translate-y-1 hover:border-primary/40 md:flex-row md:items-center md:justify-between'>
                <div className='flex min-w-0 gap-4'>
                  {show.movie?.poster_path ? (
                    <img
                      src={image_base_url + show.movie.poster_path}
                      alt={show.movie?.title || 'Poster phim'}
                      className='h-28 w-20 rounded-2xl object-cover'
                    />
                  ) : (
                    <div className='flex h-28 w-20 items-center justify-center rounded-2xl bg-white/8 text-xs text-gray-400'>
                      No poster
                    </div>
                  )}

                  <div className='min-w-0'>
                    <p className='text-lg font-semibold text-white'>{show.movie?.title || 'Chưa có tên phim'}</p>
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
                    <p className='text-xs uppercase tracking-[0.2em] text-emerald-200/80'>Doanh thu</p>
                    <p className='mt-2 text-lg font-semibold text-white'>{formatCurrency(show.totalEarnings, currency)}</p>
                  </div>
                  <div className='rounded-2xl border border-sky-400/15 bg-sky-500/10 px-4 py-3'>
                    <p className='text-xs uppercase tracking-[0.2em] text-sky-100/80'>Công suất nhanh</p>
                    <p className='mt-2 text-lg font-semibold text-white'>{show.soldSeatCount || 0} bán / {show.heldSeatCount || 0} giữ</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text='Chưa có dữ liệu trong khoảng thời gian này.' minHeight='min-h-[220px]' />
        )}
      </SectionCard>
    </div>
  )
}

export default DashBoard
