import React, { useEffect, useMemo, useRef, useState } from 'react'
import { assets } from '../assets/assets'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { MenuIcon, SearchIcon, TicketPlus, WalletIcon, XIcon } from 'lucide-react'
import { useClerk, UserButton, useUser } from '@clerk/clerk-react'
import { useAppContext } from '../context/AppContext'
import { getMovieTitle } from '../lib/movieDisplay'
import { searchMovies } from '../lib/movieSearch'

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const { user } = useUser()
  const { openSignIn } = useClerk()
  const navigate = useNavigate()
  const location = useLocation()
  const { favoriteMovies, image_base_url, shows, walletBalance } = useAppContext()
  const currency = import.meta.env.VITE_CURRENCY
  const desktopSearchRef = useRef(null)
  const mobileSearchRef = useRef(null)
  const desktopSearchInputRef = useRef(null)
  const mobileSearchInputRef = useRef(null)

  const searchResults = useMemo(() => {
    const query = searchValue.trim()
    return query ? searchMovies(shows, query, 6) : []
  }, [searchValue, shows])

  const handleLinkClick = () => {
    scrollTo(0, 0)
    setIsOpen(false)
    setIsSearchActive(false)
  }

  const closeSearch = () => {
    setIsSearchActive(false)
  }

  const submitSearch = (event) => {
    event?.preventDefault()
    const query = searchValue.trim()

    closeSearch()
    setIsOpen(false)
    navigate(query ? `/movies?q=${encodeURIComponent(query)}` : '/movies')
    scrollTo(0, 0)
  }

  const goToMovie = (movieId) => {
    closeSearch()
    setSearchValue('')
    navigate(`/movies/${movieId}`)
    scrollTo(0, 0)
  }

  const handleSearchChange = (event) => {
    setSearchValue(event.target.value)
    setIsSearchActive(Boolean(event.target.value.trim()))
  }

  const activateSearch = () => {
    setIsSearchActive(Boolean(searchValue.trim()))
  }

  useEffect(() => {
    const handlePointerDown = (event) => {
      const isInDesktopSearch = desktopSearchRef.current?.contains(event.target)
      const isInMobileSearch = mobileSearchRef.current?.contains(event.target)

      if (!isInDesktopSearch && !isInMobileSearch) {
        closeSearch()
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeSearch()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    const closeTimer = setTimeout(() => {
      setIsSearchActive(false)
    }, 0)

    return () => clearTimeout(closeTimer)
  }, [location.pathname])

  const renderSearchResults = (showHeader = true) => (
    <>
      {showHeader && searchValue.trim() && (
        <p className='px-3 py-2 text-xs font-medium uppercase tracking-[0.2em] text-gray-500'>
          Kết quả phù hợp
        </p>
      )}

      {searchResults.length > 0 ? (
        <div className='space-y-1'>
          {searchResults.map((movie) => {
            const title = getMovieTitle(movie)
            const englishTitle = movie.titleVi ? (movie.title || movie.original_title || '') : ''
            const secondaryTitle = englishTitle && englishTitle !== title ? englishTitle : ''
            const poster = movie.poster_path ? image_base_url + movie.poster_path : image_base_url + movie.backdrop_path
            const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : ''

            return (
              <button
                key={movie._id}
                type='button'
                onClick={() => goToMovie(movie._id)}
                className='flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/8'
              >
                <img
                  src={poster}
                  alt={title}
                  className='h-16 w-11 shrink-0 rounded-lg object-cover'
                />
                <span className='min-w-0 flex-1'>
                  <span className='block truncate text-[15px] font-semibold text-white'>{title}</span>
                  {secondaryTitle && (
                    <span className='mt-0.5 block truncate text-[13px] font-medium text-gray-400'>
                      {secondaryTitle}
                    </span>
                  )}
                  <span className='mt-1 block truncate text-xs text-gray-400'>
                    {[releaseYear, movie.director].filter(Boolean).join(' • ')}
                  </span>
                </span>
                <span className='hidden shrink-0 text-xs font-medium text-primary sm:inline'>
                  Chi tiết
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className='px-3 py-8 text-center text-sm text-gray-400'>
          Không tìm thấy phim phù hợp.
        </div>
      )}
    </>
  )

  const renderSearchForm = (mobile = false) => (
    <form onSubmit={submitSearch} className='flex h-11 items-center gap-3 px-4'>
      <SearchIcon className='h-5 w-5 shrink-0 text-primary' />
      <input
        ref={mobile ? mobileSearchInputRef : desktopSearchInputRef}
        value={searchValue}
        onChange={handleSearchChange}
        onFocus={activateSearch}
        placeholder='Tìm phim hoặc đạo diễn...'
        className='min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500'
      />
      {searchValue && !mobile && (
        <button
          type='button'
          onClick={() => setSearchValue('')}
          className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/10 hover:text-white'
          aria-label='Xóa tìm kiếm'
        >
          <XIcon className='h-4 w-4' />
        </button>
      )}
      {mobile && (
        <button
          type='button'
          onClick={() => {
            setSearchValue('')
            closeSearch()
          }}
          className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/10 hover:text-white'
          aria-label='Đóng tìm kiếm'
        >
          <XIcon className='h-4 w-4' />
        </button>
      )}
    </form>
  )

  return (
    <div className='fixed top-0 left-0 z-50 w-full flex items-center justify-between px-6 md:px-16 lg:px-36 py-5'>
      <Link to='/' className='max-md:flex-1'>
        <img src={assets.logo} alt='QuickShow' className='w-36 h-auto' />
      </Link>

      <div className={`max-md:absolute max-md:top-0 max-md:left-0 max-md:font-medium max-md:text-lg z-50 flex flex-col md:flex-row items-center max-md:justify-center gap-8 md:px-8 py-3 max-md:h-screen md:rounded-full backdrop-blur bg-black/70 md:bg-white/10 md:border border-gray-300/20 overflow-hidden transition-[width] duration-300 ${isOpen ? 'max-md:w-full' : 'max-md:w-0'}`}>
        <XIcon className='md:hidden absolute top-6 right-6 w-6 h-6 cursor-pointer' onClick={() => setIsOpen(!isOpen)} />

        <Link onClick={handleLinkClick} to='/'>Trang chủ</Link>
        <Link onClick={handleLinkClick} to='/movies'>Phim</Link>
        <Link onClick={handleLinkClick} to='/schedule'>Lịch chiếu</Link>
        {favoriteMovies.length > 0 && <Link onClick={handleLinkClick} to='/favorite'>Phim yêu thích</Link>}
        <div ref={mobileSearchRef} className='w-[min(320px,calc(100vw-48px))] md:hidden'>
          <div className='overflow-hidden rounded-2xl border border-white/10 bg-white/8'>
            {renderSearchForm(true)}
          </div>

          {isSearchActive && searchValue.trim() && (
            <div className='mt-2 max-h-[55vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#14151d]/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur'>
              {renderSearchResults(false)}
            </div>
          )}
        </div>
      </div>

      <div className='flex items-center gap-8'>
        <div ref={desktopSearchRef} className='relative max-md:hidden'>
          <div className='h-11 w-72 overflow-hidden rounded-full border border-white/10 bg-white/8 backdrop-blur transition focus-within:border-primary/40'>
            {renderSearchForm(false)}
          </div>

          {isSearchActive && searchValue.trim() && (
            <div className='absolute left-0 top-full z-[70] mt-2 w-[min(420px,calc(100vw-48px))] overflow-hidden rounded-2xl border border-white/10 bg-[#14151d]/95 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur'>
              <div className='max-h-[420px] overflow-y-auto p-2'>
                {renderSearchResults(true)}
              </div>

              <button
                type='button'
                onClick={submitSearch}
                className='flex w-full items-center justify-center border-t border-white/10 px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary/10'
              >
                Xem tất cả kết quả
              </button>
            </div>
          )}
        </div>

        {!user ? (
          <button onClick={() => openSignIn()} className='px-4 py-1 sm:py-2 bg-primary hover:bg-primary-dull transition rounded-full font-medium cursor-pointer'>
            Đăng nhập
          </button>
        ) : (
          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={() => navigate('/my-bookings')}
              className='inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/15 sm:px-3'
              title='Ví QuickShow'
            >
              <WalletIcon className='h-4 w-4' />
              <span>{(walletBalance || 0).toLocaleString()} {currency}</span>
            </button>
            <UserButton>
              <UserButton.MenuItems>
                <UserButton.Action
                  label='Vé của tôi'
                  labelIcon={<TicketPlus width={15} />}
                  onClick={() => navigate('/my-bookings')}
                />
              </UserButton.MenuItems>
            </UserButton>
          </div>
        )}
      </div>

      <MenuIcon onClick={() => setIsOpen(!isOpen)} className='max-md:ml-4 md:hidden w-8 h-8 cursor-pointer' />
    </div>
  )
}

export default Navbar
