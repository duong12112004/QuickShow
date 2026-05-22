import mongoose from "mongoose";

const movieSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    title: { type: String, required: true },
    titleVi: { type: String, default: "" },
    overview: { type: String, required: true },
    overviewVi: { type: String, default: "" },
    poster_path: { type: String, required: true },
    backdrop_path: { type: String, required: true },
    release_date: { type: String, required: true },
    original_title: { type: String },
    original_language: { type: String },
    tagline: { type: String },
    taglineVi: { type: String, default: "" },
    genres: { type: Array, required: true },
    genresVi: { type: Array, default: [] },
    casts: { type: Array, required: true },
    vote_average: { type: Number, required: true },
    vote_count: { type: Number, default: 0 },
    imdb_id: { type: String, default: "" },
    imdb_rating: { type: Number, default: null },
    imdb_votes: { type: String, default: "" },
    trailerUrl: { type: String, default: "" },
    trailerKey: { type: String, default: "" },
    trailerSite: { type: String, default: "" },
    director: { type: String, default: "" },
    certification: { type: String, default: "" },
    certificationCountry: { type: String, default: "" },
    production_countries: { type: Array, default: [] },
    spoken_languages: { type: Array, default: [] },
    runtime: { type: Number, required: true },
  }, { timestamps: true });
  
  const Movie = mongoose.model('Movie', movieSchema);

  export default Movie;
