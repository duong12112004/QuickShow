import React, { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  CirclePause,
  FilterX,
  PackagePlus,
  Pencil,
  Popcorn,
  Save,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import AdminPagination from '../../components/admin/AdminPagination'
import Title from '../../components/admin/Title'
import { useAppContext } from '../../context/AppContext'

const PAGE_SIZE = 8

const categoryOptions = [
  { value: 'COMBO', label: 'Combo' },
  { value: 'POPCORN', label: 'Bắp' },
  { value: 'DRINK', label: 'Nước' },
  { value: 'SNACK', label: 'Ăn vặt' },
]

const defaultForm = {
  name: '',
  description: '',
  imageUrl: '',
  price: '',
  category: 'COMBO',
  status: 'ACTIVE',
  sortOrder: 0,
}

const darkInputClassName = 'w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-primary'
const darkSelectClassName = 'w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-primary'
const darkOptionClassName = 'bg-slate-950 text-white'

const ManageConcessions = () => {
  const { axios, getToken, user } = useAppContext()
  const currency = import.meta.env.VITE_CURRENCY

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [formData, setFormData] = useState(defaultForm)
  const [formOpen, setFormOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)

  const fetchItems = async () => {
    try {
      setLoading(true)
      const { data } = await axios.get('/api/admin/concessions', {
        headers: { Authorization: `Bearer ${await getToken()}` },
      })

      if (data.success) {
        setItems(data.concessions || [])
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error('Không tải được danh sách combo bắp nước.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchItems()
    }
  }, [user])

  const filteredItems = useMemo(() => {
    const search = searchValue.trim().toLowerCase()

    return items.filter((item) => {
      const matchSearch = !search
        || `${item.name || ''} ${item.description || ''}`.toLowerCase().includes(search)
      const matchStatus = statusFilter === 'ALL' || item.status === statusFilter
      const matchCategory = categoryFilter === 'ALL' || item.category === categoryFilter

      return matchSearch && matchStatus && matchCategory
    })
  }, [items, searchValue, statusFilter, categoryFilter])

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((item) => item.status === 'ACTIVE').length,
    inactive: items.filter((item) => item.status === 'INACTIVE').length,
    averagePrice: items.length
      ? Math.round(items.reduce((sum, item) => sum + Number(item.price || 0), 0) / items.length)
      : 0,
  }), [items])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return filteredItems.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filteredItems, currentPage])
  const startRow = filteredItems.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const endRow = Math.min(currentPage * PAGE_SIZE, filteredItems.length)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchValue, statusFilter, categoryFilter])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const resetForm = () => {
    setSelectedItem(null)
    setFormData(defaultForm)
    setFormOpen(false)
  }

  const openCreateForm = () => {
    setSelectedItem(null)
    setFormData(defaultForm)
    setFormOpen(true)
  }

  const openEditForm = (item) => {
    setSelectedItem(item)
    setFormData({
      name: item.name || '',
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      price: item.price || '',
      category: item.category || 'COMBO',
      status: item.status || 'ACTIVE',
      sortOrder: item.sortOrder || 0,
    })
    setFormOpen(true)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!formData.name.trim()) {
      return toast.error('Tên món hoặc combo là bắt buộc.')
    }

    const price = Math.floor(Number(formData.price || 0))
    if (!Number.isFinite(price) || price < 0) {
      return toast.error('Giá món không hợp lệ.')
    }

    const payload = {
      ...formData,
      name: formData.name.trim(),
      description: formData.description.trim(),
      imageUrl: formData.imageUrl.trim(),
      price,
      sortOrder: Number(formData.sortOrder || 0),
    }

    try {
      setSaving(true)
      const config = { headers: { Authorization: `Bearer ${await getToken()}` } }
      const { data } = selectedItem
        ? await axios.put(`/api/admin/concessions/${selectedItem._id}`, payload, config)
        : await axios.post('/api/admin/concessions', payload, config)

      if (!data.success) {
        toast.error(data.message)
        return
      }

      toast.success(data.message)
      resetForm()
      fetchItems()
    } catch (error) {
      console.error(error)
      toast.error('Không lưu được combo bắp nước.')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (item) => {
    try {
      const nextStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      const { data } = await axios.put(
        `/api/admin/concessions/${item._id}`,
        { status: nextStatus },
        { headers: { Authorization: `Bearer ${await getToken()}` } }
      )

      if (!data.success) {
        toast.error(data.message)
        return
      }

      toast.success(data.message)
      fetchItems()
    } catch (error) {
      console.error(error)
      toast.error('Không đổi được trạng thái món.')
    }
  }

  const deleteItem = async (item) => {
    const confirmed = window.confirm(`Xóa "${item.name}" khỏi danh sách combo bắp nước?`)
    if (!confirmed) return

    try {
      const { data } = await axios.delete(`/api/admin/concessions/${item._id}`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      })

      if (!data.success) {
        toast.error(data.message)
        return
      }

      toast.success(data.message)
      fetchItems()
    } catch (error) {
      console.error(error)
      toast.error('Không xóa được món.')
    }
  }

  const resetFilters = () => {
    setSearchValue('')
    setStatusFilter('ALL')
    setCategoryFilter('ALL')
  }

  return (
    <div className='space-y-8'>
      <Title text1='Quản lý' text2='Combo bắp nước' />

      <div className='grid gap-4 md:grid-cols-4'>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Tổng món</p>
          <p className='mt-2 text-2xl font-semibold text-white'>{stats.total}</p>
        </div>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Đang bán</p>
          <p className='mt-2 text-2xl font-semibold text-emerald-300'>{stats.active}</p>
        </div>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Ngừng bán</p>
          <p className='mt-2 text-2xl font-semibold text-gray-300'>{stats.inactive}</p>
        </div>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Giá trung bình</p>
          <p className='mt-2 text-2xl font-semibold text-primary'>{stats.averagePrice.toLocaleString()} {currency}</p>
        </div>
      </div>

      <div className='rounded-2xl border border-primary/20 bg-primary/8 p-5'>
        <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
          <div>
            <h2 className='text-lg font-medium'>Danh mục đồ ăn kèm</h2>
            <p className='text-sm text-gray-400'>Quản lý món khách có thể mua kèm khi chọn ghế.</p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              onClick={resetFilters}
              className='inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/5'
            >
              <FilterX className='h-4 w-4' />
              Đặt lại
            </button>
            <button
              type='button'
              onClick={openCreateForm}
              className='inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20'
            >
              <PackagePlus className='h-4 w-4' />
              Thêm món
            </button>
          </div>
        </div>

        <div className='mt-5 grid gap-3 md:grid-cols-3'>
          <label className='relative block'>
            <Search className='pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500' />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder='Tìm tên món hoặc mô tả'
              className={`${darkInputClassName} pl-11`}
            />
          </label>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={darkSelectClassName}>
            <option value='ALL' className={darkOptionClassName}>Tất cả loại món</option>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value} className={darkOptionClassName}>{option.label}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={darkSelectClassName}>
            <option value='ALL' className={darkOptionClassName}>Tất cả trạng thái</option>
            <option value='ACTIVE' className={darkOptionClassName}>Đang bán</option>
            <option value='INACTIVE' className={darkOptionClassName}>Ngừng bán</option>
          </select>
        </div>

        <p className='mt-4 text-xs text-gray-400'>
          {loading
            ? 'Đang tải danh sách món...'
            : filteredItems.length > 0
              ? `Đang hiển thị ${startRow}-${endRow} trên tổng ${filteredItems.length} món`
              : 'Không có món phù hợp'}
        </p>
      </div>

      <div className='overflow-x-auto rounded-2xl border border-primary/20 bg-primary/8'>
        <table className='min-w-full text-left text-sm'>
          <thead>
            <tr className='border-b border-primary/20 bg-primary/12 text-white'>
              <th className='px-4 py-3 font-medium'>Món</th>
              <th className='px-4 py-3 font-medium'>Loại</th>
              <th className='px-4 py-3 font-medium'>Giá</th>
              <th className='px-4 py-3 font-medium'>Trạng thái</th>
              <th className='px-4 py-3 text-right font-medium'>Tác vụ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className='px-4 py-8 text-center text-gray-400'>Đang tải danh sách món...</td>
              </tr>
            ) : paginatedItems.map((item) => (
              <tr key={item._id} className='border-b border-primary/15 align-top even:bg-white/2'>
                <td className='px-4 py-4'>
                  <div className='flex gap-3'>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className='h-16 w-16 rounded-xl object-cover' />
                    ) : (
                      <div className='flex h-16 w-16 items-center justify-center rounded-xl bg-black/20 text-primary'>
                        <Popcorn className='h-6 w-6' />
                      </div>
                    )}
                    <div>
                      <p className='font-medium text-white'>{item.name}</p>
                      {item.description && <p className='mt-1 max-w-md text-xs text-gray-400'>{item.description}</p>}
                      <p className='mt-1 text-xs text-gray-500'>Thứ tự: {item.sortOrder || 0}</p>
                    </div>
                  </div>
                </td>
                <td className='px-4 py-4 text-gray-300'>{categoryOptions.find((option) => option.value === item.category)?.label || item.category}</td>
                <td className='px-4 py-4 font-medium text-primary'>{Number(item.price || 0).toLocaleString()} {currency}</td>
                <td className='px-4 py-4'>
                  <span className={`rounded-full px-3 py-1 text-xs ${
                    item.status === 'ACTIVE'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-gray-500/15 text-gray-300'
                  }`}>
                    {item.status === 'ACTIVE' ? 'Đang bán' : 'Ngừng bán'}
                  </span>
                </td>
                <td className='px-4 py-4'>
                  <div className='flex flex-wrap justify-end gap-2'>
                    <button
                      type='button'
                      onClick={() => toggleStatus(item)}
                      className='inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/5'
                    >
                      {item.status === 'ACTIVE' ? <CirclePause className='h-3.5 w-3.5' /> : <CheckCircle2 className='h-3.5 w-3.5' />}
                      {item.status === 'ACTIVE' ? 'Ngừng bán' : 'Mở bán'}
                    </button>
                    <button
                      type='button'
                      onClick={() => openEditForm(item)}
                      className='inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 px-3 py-1.5 text-xs text-sky-300 hover:bg-sky-500/10'
                    >
                      <Pencil className='h-3.5 w-3.5' />
                      Sửa
                    </button>
                    <button
                      type='button'
                      onClick={() => deleteItem(item)}
                      className='inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10'
                    >
                      <Trash2 className='h-3.5 w-3.5' />
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filteredItems.length === 0 && (
          <div className='py-8 text-center text-sm text-gray-400'>Không có món phù hợp với bộ lọc hiện tại.</div>
        )}
      </div>

      <AdminPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        disabled={filteredItems.length === 0}
      />

      {formOpen && (
        <div className='fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 py-6'>
          <form onSubmit={handleSubmit} className='max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-primary/20 bg-slate-950 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.55)]'>
            <div className='flex items-center justify-between gap-4'>
              <div>
                <h2 className='text-lg font-medium'>{selectedItem ? 'Cập nhật món' : 'Thêm món mới'}</h2>
                <p className='text-sm text-gray-400'>Giá sẽ được snapshot vào booking khi khách thanh toán.</p>
              </div>
              <button type='button' onClick={resetForm} className='inline-flex items-center gap-2 rounded-lg border border-white/15 p-2 text-gray-300 hover:bg-white/10'>
                <XCircle className='h-4 w-4' />
              </button>
            </div>

            <div className='mt-5 space-y-4'>
              <div>
                <label className='mb-2 block text-sm text-gray-300'>Tên món/combo</label>
                <input
                  value={formData.name}
                  onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                  placeholder='VD: Combo bắp lớn + 2 nước'
                  className={darkInputClassName}
                />
              </div>

              <div className='grid gap-4 md:grid-cols-2'>
                <div>
                  <label className='mb-2 block text-sm text-gray-300'>Loại</label>
                  <select
                    value={formData.category}
                    onChange={(event) => setFormData((current) => ({ ...current, category: event.target.value }))}
                    className={darkSelectClassName}
                  >
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value} className={darkOptionClassName}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='mb-2 block text-sm text-gray-300'>Trạng thái</label>
                  <select
                    value={formData.status}
                    onChange={(event) => setFormData((current) => ({ ...current, status: event.target.value }))}
                    className={darkSelectClassName}
                  >
                    <option value='ACTIVE' className={darkOptionClassName}>Đang bán</option>
                    <option value='INACTIVE' className={darkOptionClassName}>Ngừng bán</option>
                  </select>
                </div>
              </div>

              <div className='grid gap-4 md:grid-cols-2'>
                <div>
                  <label className='mb-2 block text-sm text-gray-300'>Giá</label>
                  <input
                    type='number'
                    min='0'
                    value={formData.price}
                    onChange={(event) => setFormData((current) => ({ ...current, price: event.target.value }))}
                    placeholder='VD: 99000'
                    className={darkInputClassName}
                  />
                </div>
                <div>
                  <label className='mb-2 block text-sm text-gray-300'>Thứ tự hiển thị</label>
                  <input
                    type='number'
                    value={formData.sortOrder}
                    onChange={(event) => setFormData((current) => ({ ...current, sortOrder: event.target.value }))}
                    className={darkInputClassName}
                  />
                </div>
              </div>

              <div>
                <label className='mb-2 block text-sm text-gray-300'>Ảnh URL</label>
                <input
                  value={formData.imageUrl}
                  onChange={(event) => setFormData((current) => ({ ...current, imageUrl: event.target.value }))}
                  placeholder='https://...'
                  className={darkInputClassName}
                />
              </div>

              <div>
                <label className='mb-2 block text-sm text-gray-300'>Mô tả ngắn</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                  placeholder='VD: Bắp caramel lớn và 2 ly nước ngọt'
                  className={darkInputClassName}
                />
              </div>
            </div>

            <button
              type='submit'
              disabled={saving}
              className='mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60'
            >
              {selectedItem ? <Save className='h-4 w-4' /> : <PackagePlus className='h-4 w-4' />}
              {saving ? 'Đang xử lý...' : selectedItem ? 'Lưu cập nhật' : 'Thêm món'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default ManageConcessions
