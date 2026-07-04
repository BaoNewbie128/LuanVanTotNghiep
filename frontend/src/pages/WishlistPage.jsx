import { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/WishlistPage.css';
import ProductCard from '../components/ProductCard';

function WishlistPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchWishlist = useCallback(async () => {
    try {
      setLoading(true);
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get('/api/wishlist', { headers: authHeaders });

      if (response.data?.success !== true) {
        throw new Error(response.data?.message || 'Wishlist API failed');
      }
      setWishlist(response.data.data || []);
    } catch (err) {
      console.error('Failed to load wishlist:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);



  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  if (loading) {
    return <div className="wishlist-loading">Đang tải...</div>;
  }

  return (
    <div className="wishlist-container">
      <div className="wishlist-header">
        <h1>Danh Sách Yêu Thích Của Tôi</h1>
        <p>{wishlist.length} item{wishlist.length !== 1 ? 's' : ''}</p>
      </div>

      {wishlist.length === 0 ? (
        <div className="empty-wishlist">
          <p>Danh sách của bạn đang trống</p>
          <button onClick={() => navigate('/products')} className="btn-continue-shopping">
            Tiếp tục mua sắm
          </button>
        </div>
      ) : (
<div className="wishlist-grid">
{
 wishlist.map(item=>(
   <ProductCard
    key={item.id}
    product={item.product}
    initialWishlisted={true}

    onAddToWishlist={async(product,state)=>{

      try{

        if(state){

          await axios.post(
            '/api/wishlist/add',
            {
              product_id:product.id
            },
            {
              headers:{
                Authorization:`Bearer ${token}`
              }
            }
          );

          return {
            success:true,
            inWishlist:true
          };

        }else{

          await axios.delete(
            `/api/wishlist/remove/${product.id}`,
            {
              headers:{
                Authorization:`Bearer ${token}`
              }
            }
          );


          setWishlist(prev =>
            prev.filter(
              x=>x.product_id!==product.id
            )
          );


          return {
            success:true,
            inWishlist:false
          };
        }


      }catch(err){

        return {
          success:false,
          message:err.response?.data?.message
        };

      }

    }}
   />
 ))
}
</div>
      )}
    </div>
  );
}
export default WishlistPage;
