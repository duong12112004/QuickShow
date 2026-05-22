import React from 'react'
import { XIcon } from 'lucide-react'

const TrailerModal = ({ embedUrl, title, onClose }) => {
  if (!embedUrl) {
    return null
  }

  return (
    <div className='fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm'>
      <div className='relative w-full max-w-5xl overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#10121a] shadow-[0_30px_100px_rgba(0,0,0,0.55)]'>
        <div className='flex items-center justify-between border-b border-white/10 px-5 py-4'>
          <p className='truncate text-base font-semibold text-white'>{title}</p>
          <button
            type='button'
            onClick={onClose}
            className='rounded-full border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:border-primary/40 hover:text-white'
            aria-label='Đóng trailer'
          >
            <XIcon className='h-5 w-5' />
          </button>
        </div>

        <div className='aspect-video w-full bg-black'>
          <iframe
            src={embedUrl}
            title={title}
            className='h-full w-full'
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
            allowFullScreen
          />
        </div>
      </div>
    </div>
  )
}

export default TrailerModal
