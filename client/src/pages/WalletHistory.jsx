import React, { useCallback, useEffect, useState } from 'react'
import { useClerk } from '@clerk/clerk-react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  FilterXIcon,
  History,
  RefreshCw,
  RotateCcw,
  Ticket,
  Wallet
} from 'lucide-react'
import toast from 'react-hot-toast'
import BlurCircle from '../components/BlurCircle'
import AdminPagination from '../components/admin/AdminPagination'
import { useAppContext } from '../context/AppContext'

const PAGE_SIZE = 5

const transactionTypes = [
  { value: '', label: 'Tất cả giao dịch' },
  { value: 'CREDIT', label: 'Tiền hoàn vào ví' },
  { value: 'DEBIT', label: 'Thanh toán bằng ví' },
  { value: 'REVERSAL', label: 'Hoàn lại khoản đã trừ' }
]

const typeConfig = {
  CREDIT: {
    label: 'Tiền hoàn vào ví',
    icon: ArrowDownLeft,
    sign: '+',
    amountColor: 'text-emerald-400',
    iconClassName: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400'
  },
  DEBIT: {
    label: 'Thanh toán bằng ví',
    icon: ArrowUpRight,
    sign: '-',
    amountColor: 'text-rose-400',
    iconClassName: 'border-rose-400/20 bg-rose-400/10 text-rose-400'
  },
  REVERSAL: {
    label: 'Hoàn lại khoản đã trừ',
    icon: RotateCcw,
    sign: '+',
    amountColor: 'text-cyan-400',
    iconClassName: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-400'
  }
}

const darkSelectClassName = 'w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-primary/60'
const darkOptionClassName = 'bg-slate-950 text-white'

const formatMoney = (amount, currency) => `${Number(amount || 0).toLocaleString('vi-VN')} ${currency}`

const formatDateTime = (value) => {
  if (!value) return 'Không rõ thời gian'

  return new Date(value).toLocaleString('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

const WalletHistory = () => {
  const { axios, getToken, user, navigate, fetchWallet } = useAppContext()
  const { openSignIn } = useClerk()
  const [wallet, setWallet] = useState({
    balance: 0,
    currency: 'VND',
    transactions: [],
    pagination: { page: 1, totalPages: 1, totalTransactions: 0 }
  })
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  const currency = wallet.currency || import.meta.env.VITE_CURRENCY || 'VND'
  const pagination = wallet.pagination || {}

  const loadWalletHistory = useCallback(async () => {
    if (!user) return

    setIsLoading(true)

    try {
      const { data } = await axios.get('/api/user/wallet', {
        headers: { Authorization: `Bearer ${await getToken()}` },
        params: { page, limit: PAGE_SIZE, type }
      })

      if (data.success) {
        setWallet(data.wallet)
        return
      }

      toast.error(data.message)
    } catch (error) {
      console.error(error)
      toast.error('Không thể tải lịch sử ví QuickShow.')
    } finally {
      setIsLoading(false)
    }
  }, [axios, getToken, page, type, user])

  useEffect(() => {
    loadWalletHistory()
  }, [loadWalletHistory])

  const refreshWallet = async () => {
    await Promise.all([loadWalletHistory(), fetchWallet()])
  }

  const changeType = (value) => {
    setType(value)
    setPage(1)
  }

  const resetFilters = () => {
    setType('')
    setPage(1)
  }

  if (!user) {
    return (
      <div className='flex min-h-[80vh] flex-col items-center justify-center gap-5 px-6 text-center'>
        <div className='rounded-full border border-primary/25 bg-primary/10 p-5 text-primary'>
          <Wallet className='h-9 w-9' />
        </div>
        <div>
          <h1 className='text-2xl font-semibold'>Đăng nhập để xem ví QuickShow</h1>
          <p className='mt-2 text-sm text-gray-400'>Số dư và lịch sử giao dịch chỉ hiển thị cho chủ tài khoản.</p>
        </div>
        <button
          type='button'
          onClick={() => openSignIn()}
          className='rounded-full bg-primary px-6 py-2.5 text-sm font-medium transition hover:bg-primary-dull'
        >
          Đăng nhập
        </button>
      </div>
    )
  }

  return (
    <div className='relative min-h-[80vh] px-6 pt-30 md:px-10 md:pt-40 lg:px-16 xl:px-24'>
      <BlurCircle top='100px' left='100px' />
      <BlurCircle bottom='0px' left='600px' />

      <div className='mx-auto max-w-7xl'>
        <div className='mb-8 flex flex-col gap-2'>
          <h1 className='text-2xl font-semibold'>Lịch sử ví QuickShow</h1>
          <p className='max-w-2xl text-sm text-gray-400'>
            Theo dõi số dư, tiền hoàn, khoản thanh toán bằng ví và các giao dịch được hoàn lại tại đây.
          </p>
        </div>

        <div className='mb-6 rounded-2xl border border-primary/20 bg-primary/8 p-5'>
          <div className='flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between'>
            <div>
              <p className='text-sm text-gray-400'>Số dư ví QuickShow</p>
              <p className='mt-2 text-2xl font-semibold text-primary'>{formatMoney(wallet.balance, currency)}</p>
              <p className='mt-2 max-w-xl text-sm text-gray-300'>
                Số dư này có thể dùng để trừ trực tiếp khi bạn đặt vé tiếp theo.
              </p>
            </div>

            <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
              <button
                type='button'
                onClick={() => navigate('/my-bookings')}
                className='inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/5'
              >
                <Ticket className='h-4 w-4' />
                Booking của tôi
              </button>
              <button
                type='button'
                onClick={refreshWallet}
                disabled={isLoading}
                className='inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60'
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>
          </div>
        </div>

        <div className='mb-6 rounded-2xl border border-primary/20 bg-primary/8 p-5'>
          <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
            <div>
              <p className='text-lg font-semibold text-white'>Bộ lọc giao dịch</p>
              <p className='mt-1 text-sm text-gray-400'>
                Lọc theo loại giao dịch. Mỗi trang hiển thị {PAGE_SIZE} giao dịch.
              </p>
            </div>
            <button
              type='button'
              onClick={resetFilters}
              className='inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/5'
            >
              <FilterXIcon className='h-4 w-4' />
              Đặt lại
            </button>
          </div>

          <div className='mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
            <select
              value={type}
              onChange={(event) => changeType(event.target.value)}
              className={darkSelectClassName}
            >
              {transactionTypes.map((option) => (
                <option key={option.value || 'all-wallet'} value={option.value} className={darkOptionClassName}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className='flex items-center rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-300'>
              {pagination.totalTransactions > 0
                ? `Đang có ${pagination.totalTransactions} giao dịch phù hợp`
                : 'Không có giao dịch phù hợp với bộ lọc hiện tại'}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className='flex min-h-64 items-center justify-center rounded-3xl border border-primary/20 bg-primary/8'>
            <div className='h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-primary' />
          </div>
        ) : wallet.transactions?.length ? (
          <div className='space-y-5 pb-10'>
            {wallet.transactions.map((transaction) => {
              const config = typeConfig[transaction.type] || typeConfig.CREDIT
              const Icon = config.icon

              return (
                <div
                  key={transaction._id}
                  className='rounded-3xl border border-primary/20 bg-primary/8 p-5 shadow-[0_10px_40px_rgba(244,69,101,0.08)] lg:p-6'
                >
                  <div className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start'>
                    <div className='flex min-w-0 gap-4'>
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${config.iconClassName}`}>
                        <Icon className='h-5 w-5' />
                      </div>

                      <div className='min-w-0'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <p className='text-lg font-semibold text-white'>{config.label}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                            transaction.status === 'FAILED'
                              ? 'bg-rose-400/10 text-rose-300'
                              : 'bg-emerald-400/10 text-emerald-300'
                          }`}>
                            {transaction.status === 'FAILED' ? 'Thất bại' : 'Hoàn tất'}
                          </span>
                        </div>

                        <p className='mt-2 text-sm text-gray-300'>{transaction.note || 'Giao dịch ví QuickShow'}</p>

                        <div className='mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-400'>
                          <span>{formatDateTime(transaction.createdAt)}</span>
                          {transaction.booking?.bookingCode && <span>Mã booking: {transaction.booking.bookingCode}</span>}
                          {transaction.booking?.movieTitle && <span>{transaction.booking.movieTitle}</span>}
                        </div>
                      </div>
                    </div>

                    <div className='rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300 lg:text-right'>
                      <p className={`text-xl font-semibold ${config.amountColor}`}>
                        {config.sign}{formatMoney(transaction.amount, transaction.currency || currency)}
                      </p>
                      <p className='mt-2 text-gray-400'>
                        Số dư sau giao dịch
                      </p>
                      <p className='mt-1 font-medium text-white'>
                        {formatMoney(transaction.balanceAfter, transaction.currency || currency)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className='rounded-2xl border border-primary/20 bg-primary/8 p-6 text-sm text-gray-300'>
            Chưa có giao dịch ví nào phù hợp. Các giao dịch mới sẽ xuất hiện tại đây.
          </div>
        )}

        {!isLoading && pagination.totalPages > 1 && (
          <div className='pb-12'>
            <AdminPagination
              currentPage={page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default WalletHistory
