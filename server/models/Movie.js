import mongoose from "mongoose";

const movieSchema = new mongoose.Schema({
    // ID phim dạng String, thường lấy từ nguồn dữ liệu phim bên ngoài.
    _id: { type: String, required: true },
    // Tên phim mặc định và tên phim tiếng Việt.
    title: { type: String, required: true },
    titleVi: { type: String, default: "" },
    // Nội dung giới thiệu mặc định và bản tiếng Việt.
    overview: { type: String, required: true },
    overviewVi: { type: String, default: "" },
    // Đường dẫn ảnh poster dọc và ảnh nền ngang.
    poster_path: { type: String, required: true },
    backdrop_path: { type: String, required: true },
    // Ngày phim phát hành.
    release_date: { type: String, required: true },
    // Tên gốc của phim.
    original_title: { type: String },
    // Mã ngôn ngữ gốc, ví dụ en, vi, ko.
    original_language: { type: String },
    // Câu khẩu hiệu quảng bá mặc định và bản tiếng Việt.
    tagline: { type: String },
    taglineVi: { type: String, default: "" },
    // Danh sách thể loại mặc định và bản tiếng Việt.
    genres: { type: Array, required: true },
    genresVi: { type: Array, default: [] },
    // Danh sách diễn viên.
    casts: { type: Array, required: true },
    // Điểm đánh giá trung bình và số lượt đánh giá từ nguồn dữ liệu phim.
    vote_average: { type: Number, required: true },
    vote_count: { type: Number, default: 0 },
    // ID, điểm và số lượt đánh giá của phim trên IMDb.
    imdb_id: { type: String, default: "" },
    imdb_rating: { type: Number, default: null },
    imdb_votes: { type: String, default: "" },
    // URL trailer, mã video trailer và nền tảng chứa trailer, ví dụ YouTube.
    trailerUrl: { type: String, default: "" },
    trailerKey: { type: String, default: "" },
    trailerSite: { type: String, default: "" },
    // Tên đạo diễn.
    director: { type: String, default: "" },
    // Nhãn giới hạn độ tuổi và quốc gia áp dụng nhãn đó.
    certification: { type: String, default: "" },
    certificationCountry: { type: String, default: "" },
    // Danh sách quốc gia sản xuất.
    production_countries: { type: Array, default: [] },
    // Danh sách ngôn ngữ được nói trong phim.
    spoken_languages: { type: Array, default: [] },
    // Thời lượng phim tính bằng phút.
    runtime: { type: Number, required: true },
  // timestamps tự thêm createdAt và updatedAt.
  }, { timestamps: true });
  
  const Movie = mongoose.model('Movie', movieSchema);

  export default Movie;
