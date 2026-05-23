const normalizeSearchText = (value = '') => {
  return `${value}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
}

const getSearchFields = (movie) => [
  movie?.title,
  movie?.titleVi,
  movie?.original_title,
  movie?.director
]

export const getNormalizedMovieTitle = (movie) => {
  return normalizeSearchText(`${movie?.titleVi || ''} ${movie?.title || ''} ${movie?.original_title || ''}`)
}

export const normalizeMovieQuery = normalizeSearchText

export const movieMatchesQuery = (movie, query) => {
  const normalizedQuery = normalizeSearchText(query)

  if (!normalizedQuery) {
    return true
  }

  const searchText = normalizeSearchText(getSearchFields(movie).join(' '))
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)

  return tokens.every((token) => searchText.includes(token))
}

export const searchMovies = (movies = [], query, limit) => {
  const normalizedQuery = normalizeSearchText(query)

  if (!normalizedQuery) {
    return limit ? movies.slice(0, limit) : movies
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)

  const rankedMovies = movies
    .map((movie, index) => {
      const titleText = getNormalizedMovieTitle(movie)
      const searchText = normalizeSearchText(getSearchFields(movie).join(' '))

      if (!tokens.every((token) => searchText.includes(token))) {
        return null
      }

      let score = 10

      if (titleText === normalizedQuery) {
        score += 100
      } else if (titleText.startsWith(normalizedQuery)) {
        score += 70
      } else if (titleText.includes(normalizedQuery)) {
        score += 45
      }

      score += tokens.filter((token) => titleText.includes(token)).length * 8

      return { movie, index, score }
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ movie }) => movie)

  return limit ? rankedMovies.slice(0, limit) : rankedMovies
}
