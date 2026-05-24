import React from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'

const clampPage = (value, totalPages) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return null
  return Math.min(Math.max(parsed, 1), totalPages)
}

const AdminPagination = ({ currentPage, totalPages, onPageChange, disabled = false }) => {
  const pageCount = Math.max(1, Number(totalPages || 1))
  const isPreviousDisabled = disabled || currentPage <= 1
  const isNextDisabled = disabled || currentPage >= pageCount

  const goToPage = (value) => {
    const nextPage = clampPage(value, pageCount)
    if (nextPage) {
      onPageChange(nextPage)
    }
  }

  return (
    <div className='flex justify-center'>
      <div className='inline-flex items-center gap-3 rounded-full'>
        <button
          type='button'
          onClick={() => goToPage(currentPage - 1)}
          disabled={isPreviousDisabled}
          className='flex h-12 w-12 items-center justify-center rounded-full bg-[#252839] text-gray-200 transition hover:bg-[#303448] disabled:cursor-not-allowed disabled:opacity-45'
          aria-label='Trang trước'
        >
          <ArrowLeft className='h-5 w-5' />
        </button>

        <div className='flex h-12 items-center gap-2 rounded-full bg-[#252839] px-5 text-sm font-medium text-white'>
          <span>Trang</span>
          <input
            type='number'
            min='1'
            max={pageCount}
            value={currentPage}
            onChange={(event) => goToPage(event.target.value)}
            className='h-8 w-16 rounded-md border border-white/10 bg-[#303448] text-center text-sm font-semibold text-white outline-none transition focus:border-primary/50'
            aria-label='Trang hiện tại'
          />
          <span>/ {pageCount}</span>
        </div>

        <button
          type='button'
          onClick={() => goToPage(currentPage + 1)}
          disabled={isNextDisabled}
          className='flex h-12 w-12 items-center justify-center rounded-full bg-[#252839] text-gray-200 transition hover:bg-[#303448] disabled:cursor-not-allowed disabled:opacity-45'
          aria-label='Trang sau'
        >
          <ArrowRight className='h-5 w-5' />
        </button>
      </div>
    </div>
  )
}

export default AdminPagination
