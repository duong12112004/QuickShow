import React, { useEffect, useRef, useState } from 'react'
import { AlertCircle, XCircle } from 'lucide-react'

const variantClassMap = {
  amber: {
    icon: 'border-amber-400/25 bg-amber-500/10 text-amber-300',
    button: 'border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20',
  },
  rose: {
    icon: 'border-rose-400/25 bg-rose-500/10 text-rose-300',
    button: 'border-rose-400/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20',
  },
  violet: {
    icon: 'border-violet-400/25 bg-violet-500/10 text-violet-300',
    button: 'border-violet-400/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20',
  },
}

const AdminReasonModal = ({
  title,
  description,
  label = 'Lý do',
  placeholder = 'Nhập lý do...',
  initialValue = '',
  confirmText = 'Xác nhận',
  isSubmitting = false,
  variant = 'amber',
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState(initialValue)
  const textareaRef = useRef(null)
  const variantClass = variantClassMap[variant] || variantClassMap.amber

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) onClose()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    window.setTimeout(() => textareaRef.current?.focus(), 0)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSubmitting, onClose])

  const handleSubmit = (event) => {
    event.preventDefault()
    onConfirm(reason.trim())
  }

  return (
    <div
      className='fixed inset-0 z-[130] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose()
      }}
      role='dialog'
      aria-modal='true'
      aria-labelledby='admin-reason-title'
    >
      <form onSubmit={handleSubmit} className='w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.7)]'>
        <div className='flex items-start justify-between gap-4'>
          <div className='flex items-start gap-3'>
            <div className={`rounded-2xl border p-2.5 ${variantClass.icon}`}>
              <AlertCircle className='h-5 w-5' />
            </div>
            <div>
              <h2 id='admin-reason-title' className='text-lg font-semibold text-white'>{title}</h2>
              {description && <p className='mt-1 text-sm leading-6 text-gray-400'>{description}</p>}
            </div>
          </div>
          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='rounded-xl border border-white/15 p-2 text-gray-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'
            aria-label='Đóng ô nhập lý do'
          >
            <XCircle className='h-5 w-5' />
          </button>
        </div>

        <div className='mt-5'>
          <label className='mb-2 block text-sm font-medium text-gray-300'>{label}</label>
          <textarea
            ref={textareaRef}
            rows={5}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={placeholder}
            className='w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-gray-600 focus:border-primary'
          />
          <p className='mt-2 text-xs text-gray-500'>Lý do này sẽ được lưu vào hệ thống để tiện đối soát và kiểm duyệt.</p>
        </div>

        <div className='mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'>
          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-gray-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50'
          >
            Hủy
          </button>
          <button
            type='submit'
            disabled={isSubmitting}
            className={`rounded-full border px-5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClass.button}`}
          >
            {isSubmitting ? 'Đang xử lý...' : confirmText}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AdminReasonModal
