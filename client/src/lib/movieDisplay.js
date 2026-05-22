export const getMovieTitle = (movie) => movie?.titleVi || movie?.title || 'Phim chưa cập nhật tên'

export const getMovieOriginalTitle = (movie) => {
  const originalTitle = movie?.original_title || movie?.title
  const displayTitle = getMovieTitle(movie)

  return originalTitle && originalTitle !== displayTitle ? originalTitle : ''
}

export const getMovieOverview = (movie) => {
  return movie?.overviewVi || movie?.overview || 'QuickShow đang cập nhật mô tả cho bộ phim này.'
}

export const getMovieTagline = (movie) => {
  return movie?.taglineVi || movie?.tagline || getMovieOriginalTitle(movie) || 'Phim chiếu rạp QuickShow'
}

export const getMovieGenres = (movie) => {
  return (movie?.genresVi?.length ? movie.genresVi : movie?.genres) || []
}

const CERTIFICATION_MAP = {
  P: 'P',
  K: 'K',
  T13: '13+',
  T16: '16+',
  T18: '18+',
  G: 'P',
  PG: 'K',
  'PG-13': '13+',
  R: '18+',
  'NC-17': '18+'
}

const COUNTRY_MAP = {
  AR: 'Argentina',
  AU: 'Úc',
  BR: 'Brazil',
  CA: 'Canada',
  CN: 'Trung Quốc',
  DE: 'Đức',
  ES: 'Tây Ban Nha',
  FR: 'Pháp',
  GB: 'Anh',
  HK: 'Hồng Kông',
  ID: 'Indonesia',
  IN: 'Ấn Độ',
  IT: 'Ý',
  JP: 'Nhật Bản',
  KR: 'Hàn Quốc',
  MX: 'Mexico',
  MY: 'Malaysia',
  NZ: 'New Zealand',
  PH: 'Philippines',
  RU: 'Nga',
  SG: 'Singapore',
  TH: 'Thái Lan',
  TW: 'Đài Loan',
  US: 'Mỹ',
  VN: 'Việt Nam'
}

const LANGUAGE_MAP = {
  de: 'Tiếng Đức',
  en: 'Tiếng Anh',
  es: 'Tiếng Tây Ban Nha',
  fr: 'Tiếng Pháp',
  hi: 'Tiếng Hindi',
  id: 'Tiếng Indonesia',
  it: 'Tiếng Ý',
  ja: 'Tiếng Nhật',
  ko: 'Tiếng Hàn',
  ms: 'Tiếng Mã Lai',
  pt: 'Tiếng Bồ Đào Nha',
  ru: 'Tiếng Nga',
  th: 'Tiếng Thái',
  tl: 'Tiếng Philippines',
  vi: 'Tiếng Việt',
  zh: 'Tiếng Trung'
}

export const formatCertification = (movie) => {
  const certification = movie?.certification

  if (!certification) {
    return 'Chưa cập nhật'
  }

  return CERTIFICATION_MAP[certification] || certification
}

export const formatCountries = (countries = []) => {
  return countries
    .map((country) => COUNTRY_MAP[country?.iso_3166_1] || country?.name)
    .filter(Boolean)
    .join(', ') || 'Chưa cập nhật'
}

export const formatLanguages = (languages = []) => {
  return languages
    .map((language) => LANGUAGE_MAP[language?.iso_639_1] || language?.name || language?.english_name)
    .filter(Boolean)
    .join(', ') || 'Chưa cập nhật'
}

export const getYoutubeEmbedUrl = (movie) => {
  if (movie?.trailerKey) {
    return `https://www.youtube.com/embed/${movie.trailerKey}?autoplay=1&rel=0`
  }

  if (!movie?.trailerUrl) {
    return ''
  }

  const match = movie.trailerUrl.match(/(?:v=|youtu\.be\/)([^&?]+)/)
  return match?.[1] ? `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0` : ''
}
