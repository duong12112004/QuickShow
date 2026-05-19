import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios"
import { useAuth, useUser } from "@clerk/clerk-react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

// Cấu hình Base URL mặc định cho toàn bộ các request Axios
axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    // --- KHỐI QUẢN LÝ TRẠNG THÁI (STATES) ---
    const [isAdmin, setIsAdmin] = useState(false);
    const [shows, setShows] = useState([]);
    const [favoriteMovies, setFavoriteMovies] = useState([]);
    const [wallet, setWallet] = useState({ balance: 0, transactions: [] });

    const image_base_url = import.meta.env.VITE_TMDB_IMAGE_BASE_URL;

    // --- CÁC HOOKS TIỆN ÍCH ---
    const { user } = useUser();
    const { getToken } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // --- KHỐI HÀM GỌI API ---

    // Kiểm tra quyền quản trị trị viên của người dùng hiện tại
    const fetchIsAdmin = async () => {
        try {
            const { data } = await axios.get('/api/admin/is-admin', { 
                headers: {
                    Authorization: `Bearer ${await getToken()}`
                }
            });
            setIsAdmin(data.isAdmin);
    
            // Logic bảo vệ Route: Đẩy người dùng về trang chủ nếu cố tình vào URL /admin khi không có quyền
            if (!data.isAdmin && location.pathname.startsWith('/admin')) {
                navigate('/');
                toast.error('Bạn không có quyền truy cập trang quản trị!');
            }
        } catch (error) {
            console.error(error);
        }
    };

    // Lấy danh sách toàn bộ suất chiếu đang có sẵn
    const fetchShows = async () => {
        try {
            const { data } = await axios.get('/api/show/all');
            if (data.success) {
                setShows(data.shows);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error(error);
        }
    };

    // Lấy danh sách phim yêu thích của người dùng đang đăng nhập
    const fetchFavoriteMovies = async () => {
        try {
            const { data } = await axios.get('/api/user/favorites', { 
                headers: { Authorization: `Bearer ${await getToken()}` } 
            });
    
            if (data.success) {
                setFavoriteMovies(data.movies);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchWallet = async () => {
        if (!user) {
            setWallet({ balance: 0, transactions: [] });
            return { balance: 0, transactions: [] };
        }

        try {
            const { data } = await axios.get('/api/user/wallet', {
                headers: { Authorization: `Bearer ${await getToken()}` }
            });

            if (data.success) {
                const nextWallet = data.wallet || { balance: 0, transactions: [] };
                setWallet(nextWallet);
                return nextWallet;
            }

            toast.error(data.message);
        } catch (error) {
            console.error(error);
        }

        return wallet;
    };

    // --- KHỐI SIDE EFFECTS (VÒNG ĐỜI COMPONENT) ---

    // Tự động tải dữ liệu suất chiếu ngay khi ứng dụng vừa khởi chạy
    useEffect(() => {
        fetchShows();
    }, []);
    
    // Kích hoạt lấy dữ liệu cá nhân & phân quyền sau khi xác thực Clerk thành công
    useEffect(() => {
        if (user) {
            fetchIsAdmin();
            fetchFavoriteMovies();
            fetchWallet();
        } else {
            setWallet({ balance: 0, transactions: [] });
        }
    }, [user]);

    // Cung cấp các biến và hàm dùng chung cho toàn bộ cây Component
    const value = {
        axios,
        fetchIsAdmin,
        fetchShows,
        user,
        getToken,
        navigate,
        isAdmin,
        shows,
        favoriteMovies,
        fetchFavoriteMovies,
        wallet,
        walletBalance: wallet.balance || 0,
        fetchWallet,
        image_base_url
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

// Custom Hook để gọi AppContext nhanh hơn ở các file khác
export const useAppContext = () => useContext(AppContext);
