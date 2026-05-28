import React, { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const Loading = () => {
  const { nextUrl } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { axios, getToken, user } = useAppContext();

  useEffect(() => {
    let cancelled = false;
    let timer;

    const syncPaymentAndNavigate = async () => {
      const sessionId = searchParams.get('session_id');
      const zalopayAppTransId = searchParams.get('apptransid') || searchParams.get('app_trans_id');

      if ((sessionId || zalopayAppTransId) && user) {
        try {
          await axios.post('/api/user/bookings/confirm-payment', {
            sessionId,
            zalopayAppTransId
          }, {
            headers: { Authorization: `Bearer ${await getToken()}` }
          });
        } catch (error) {
          console.error('Không thể đồng bộ thanh toán Stripe:', error);
        }
      }

      if (!cancelled && nextUrl) {
        timer = setTimeout(() => {
          navigate('/' + nextUrl);
        }, 1500);
      }
    };

    syncPaymentAndNavigate();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [axios, getToken, navigate, nextUrl, searchParams, user]);

  return (
    <div className='flex h-[80vh] items-center justify-center'>
      <div className='animate-spin rounded-full border-2 border-t-primary h-14 w-14'></div>
    </div>
  );
};

export default Loading;
