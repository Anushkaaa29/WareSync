import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getInventory,
  getProducts,
  getRacks,
  getWarehouses,
  stockIn,
  stockOut,
  transferStock,
  adjustInventory,
} from '../services/api';
import StatusBadge from '../components/StatusBadge';
import './Inventory.css';

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [racks, setRacks] = useState([]);
  const [warehouseFilter, setWarehouseFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('stock_in'); // 'stock_in' | 'stock_out' | 'transfer' | 'adjust'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Form Fields
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [inventoryResponse, productResponse, warehouseResponse, rackResponse] = await Promise.all([
        getInventory(),
        getProducts(),
        getWarehouses(),
        getRacks(),
      ]);

      setInventory(inventoryResponse || []);
      setProducts(productResponse || []);
      setWarehouses(warehouseResponse || []);
      setRacks(rackResponse || []);
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Unable to load inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const productMap = useMemo(() => Object.fromEntries(products.map((product) => [product.id, product])), [products]);
  const warehouseMap = useMemo(() => Object.fromEntries(warehouses.map((warehouse) => [warehouse.id, warehouse.name])), [warehouses]);
  const rackMap = useMemo(() => Object.fromEntries(racks.map((rack) => [rack.id, rack.name])), [racks]);

  const enrichedInventory = useMemo(() => inventory.map((entry) => {
    const product = productMap[entry.productId];
    const status = Number(entry.quantity || 0) === 0 ? 'out_of_stock' : Number(product?.reorderLevel || 0) >= Number(entry.quantity || 0) ? 'low_stock' : 'in_stock';
    return {
      ...entry,
      productName: product?.name || `Product #${entry.productId}`,
      warehouseName: warehouseMap[entry.warehouseId] || 'Unknown warehouse',
      rackName: rackMap[entry.rackId] || 'Unassigned',
      status,
    };
  }), [inventory, productMap, warehouseMap, rackMap]);

  const filteredInventory = enrichedInventory.filter((entry) => {
    const matchesWarehouse = warehouseFilter === 'All' || Number(entry.warehouseId) === Number(warehouseFilter);
    const matchesStatus = statusFilter === 'All' || entry.status === statusFilter;
    return matchesWarehouse && matchesStatus;
  });

  const resetForm = () => {
    setProductId('');
    setWarehouseId('');
    setToWarehouseId('');
    setQuantity('');
    setNewQuantity('');
    setReferenceNumber('');
    setNotes('');
    setReason('');
    setModalError('');
    setModalSuccess('');
  };

  const openModal = (tabName) => {
    resetForm();
    setActiveTab(tabName);
    setIsModalOpen(true);
    // If products or warehouses couldn't be loaded previously, alert the user
    if (!products.length || !warehouses.length) {
      setModalError('Failed to load required data. Please refresh and try again.');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const switchTab = (tabName) => {
    setActiveTab(tabName);
    setModalError('');
    setModalSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');

    if (!productId) {
      setModalError('Please select a product.');
      return;
    }

    try {
      setIsSubmitting(true);

      if (activeTab === 'stock_in') {
        if (!warehouseId) {
          setModalError('Please select a warehouse.');
          return;
        }
        if (!quantity || Number(quantity) <= 0) {
          setModalError('Quantity must be greater than 0.');
          return;
        }

        await stockIn({
          productId: Number(productId),
          warehouseId: Number(warehouseId),
          quantity: Number(quantity),
          referenceNumber: referenceNumber.trim() || null,
          notes: notes.trim() || null,
        });

        setModalSuccess('Stock In operation completed successfully!');
      } else if (activeTab === 'stock_out') {
        if (!warehouseId) {
          setModalError('Please select a warehouse.');
          return;
        }
        if (!quantity || Number(quantity) <= 0) {
          setModalError('Quantity must be greater than 0.');
          return;
        }

        await stockOut({
          productId: Number(productId),
          warehouseId: Number(warehouseId),
          quantity: Number(quantity),
          referenceNumber: referenceNumber.trim() || null,
          notes: notes.trim() || null,
        });

        setModalSuccess('Stock Out operation completed successfully!');
      } else if (activeTab === 'transfer') {
        if (!warehouseId) {
          setModalError('Please select a source warehouse.');
          return;
        }
        if (!toWarehouseId) {
          setModalError('Please select a destination warehouse.');
          return;
        }
        if (Number(warehouseId) === Number(toWarehouseId)) {
          setModalError('Source and destination cannot be the same warehouse.');
          return;
        }
        if (!quantity || Number(quantity) <= 0) {
          setModalError('Quantity must be greater than 0.');
          return;
        }

        await transferStock({
          productId: Number(productId),
          sourceWarehouseId: Number(warehouseId),
          destinationWarehouseId: Number(toWarehouseId),
          quantity: Number(quantity),
          referenceNumber: referenceNumber.trim() || null,
          notes: notes.trim() || null,
        });

        setModalSuccess('Stock Transfer completed successfully!');
      } else if (activeTab === 'adjust') {
        if (!warehouseId) {
          setModalError('Please select a warehouse.');
          return;
        }
        if (newQuantity === '' || Number(newQuantity) < 0) {
          setModalError('New quantity must be 0 or greater.');
          return;
        }
        if (!reason || !reason.trim()) {
          setModalError('Reason is required for inventory adjustment (required for audit).');
          return;
        }

        await adjustInventory({
          productId: Number(productId),
          warehouseId: Number(warehouseId),
          newQuantity: Number(newQuantity),
          reason: reason.trim(),
        });

        setModalSuccess('Inventory adjustment completed successfully!');
      }

      // Reload fresh inventory records from database
      await loadData();

      // Reset form fields while retaining success message for a moment
      setQuantity('');
      setNewQuantity('');
      setReferenceNumber('');
      setNotes('');
      setReason('');

      setTimeout(() => {
        closeModal();
      }, 1200);
    } catch (err) {
      setModalError(err.message || 'Operation failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && !inventory.length) {
    return <div className="card"><div className="empty-state"><div className="empty-state-title">Loading inventory…</div></div></div>;
  }

  if (error && !inventory.length) {
    return <div className="card"><div className="empty-state"><div className="empty-state-title">Unable to load inventory.</div><div className="empty-state-description">{error}</div></div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Inventory</h1>
        <p className="page-subtitle">Track stock across all locations</p>
      </div>

      {/* Top 4 Action Buttons */}
      <div className="inventory-actions-row">
        <button
          type="button"
          className="inv-action-btn inv-btn-stock-in"
          onClick={() => openModal('stock_in')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
            <polyline points="17 6 23 6 23 12"></polyline>
          </svg>
          <span>Stock In</span>
        </button>

        <button
          type="button"
          className="inv-action-btn inv-btn-stock-out"
          onClick={() => openModal('stock_out')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
            <polyline points="17 18 23 18 23 12"></polyline>
          </svg>
          <span>Stock Out</span>
        </button>

        <button
          type="button"
          className="inv-action-btn inv-btn-transfer"
          onClick={() => openModal('transfer')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          <span>Transfer</span>
        </button>

        <button
          type="button"
          className="inv-action-btn inv-btn-adjust"
          onClick={() => openModal('adjust')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v18"></path>
            <path d="M5 8l7-5 7 5"></path>
            <path d="M3 14l2-6 2 6a2 2 0 0 1-4 0z"></path>
            <path d="M17 14l2-6 2 6a2 2 0 0 1-4 0z"></path>
          </svg>
          <span>Adjust</span>
        </button>
      </div>

      {/* Inventory List Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Inventory List</h3>
        </div>

        <div className="filters">
          <select className="filter-select" value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}>
            <option value="All">All Warehouses</option>
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
          </select>
          <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Status</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>PRODUCT</th>
              <th>WAREHOUSE</th>
              <th>RACK</th>
              <th>QUANTITY</th>
              <th>REORDER LEVEL</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.length ? filteredInventory.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <Link to={`/products/${entry.productId}`} className="link inv-product-link">
                    <strong>{entry.productName}</strong>
                  </Link>
                </td>
                <td>
                  <Link to={`/warehouses/${entry.warehouseId}`} className="link inv-warehouse-link">
                    {entry.warehouseName}
                  </Link>
                </td>
                <td>{entry.rackName}</td>
                <td><strong>{entry.quantity}</strong> units</td>
                <td>{productMap[entry.productId]?.reorderLevel || 0} units</td>
                <td><StatusBadge status={entry.status} text={entry.status === 'in_stock' ? 'In Stock' : entry.status === 'low_stock' ? 'Low Stock' : 'Out of Stock'} /></td>
              </tr>
            )) : (
              <tr><td colSpan="6" className="empty-state">No inventory records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Dialog for Stock In / Stock Out / Transfer / Adjust */}
      {isModalOpen && (
        <div className="inv-modal-overlay" onClick={closeModal}>
          <div className="inv-modal-dialog" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header with Tinted Header Bar */}
            <div className={`inv-modal-header inv-header-${activeTab.replace('_', '-')}`}>
              <div className="inv-modal-header-left">
                {activeTab === 'stock_in' && (
                  <>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                      <polyline points="17 6 23 6 23 12"></polyline>
                    </svg>
                    <span>Stock In</span>
                  </>
                )}
                {activeTab === 'stock_out' && (
                  <>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
                      <polyline points="17 18 23 18 23 12"></polyline>
                    </svg>
                    <span>Stock Out</span>
                  </>
                )}
                {activeTab === 'transfer' && (
                  <>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <polyline points="1 20 1 14 7 14"></polyline>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    <span>Transfer</span>
                  </>
                )}
                {activeTab === 'adjust' && (
                  <>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3v18"></path>
                      <path d="M5 8l7-5 7 5"></path>
                      <path d="M3 14l2-6 2 6a2 2 0 0 1-4 0z"></path>
                      <path d="M17 14l2-6 2 6a2 2 0 0 1-4 0z"></path>
                    </svg>
                    <span>Adjust</span>
                  </>
                )}
              </div>
              <button
                type="button"
                className="inv-modal-close-btn"
                onClick={closeModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="inv-modal-body">
              {/* Tab Navigation Strip */}
              <div className="inv-modal-tabs">
                <button
                  type="button"
                  className={`inv-tab-btn ${activeTab === 'stock_in' ? 'active-stock-in' : ''}`}
                  onClick={() => switchTab('stock_in')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <span>Stock In</span>
                </button>

                <button
                  type="button"
                  className={`inv-tab-btn ${activeTab === 'stock_out' ? 'active-stock-out' : ''}`}
                  onClick={() => switchTab('stock_out')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <span>Stock Out</span>
                </button>

                <button
                  type="button"
                  className={`inv-tab-btn ${activeTab === 'transfer' ? 'active-transfer' : ''}`}
                  onClick={() => switchTab('transfer')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9"></polyline>
                    <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                    <polyline points="7 23 3 19 7 15"></polyline>
                    <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                  </svg>
                  <span>Transfer</span>
                </button>

                <button
                  type="button"
                  className={`inv-tab-btn ${activeTab === 'adjust' ? 'active-adjust' : ''}`}
                  onClick={() => switchTab('adjust')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v18"></path>
                    <path d="M5 8l7-5 7 5"></path>
                    <path d="M3 14l2-6 2 6a2 2 0 0 1-4 0z"></path>
                    <path d="M17 14l2-6 2 6a2 2 0 0 1-4 0z"></path>
                  </svg>
                  <span>Adjust</span>
                </button>
              </div>

              {/* Feedback Alerts */}
              {modalError && (
                <div className="inv-alert-error">
                  <span>{modalError}</span>
                </div>
              )}

              {modalSuccess && (
                <div className="inv-alert-success">
                  <span>{modalSuccess}</span>
                </div>
              )}

              {/* Dynamic Form */}
              <form onSubmit={handleSubmit}>
                {/* 1. STOCK IN FORM */}
                {activeTab === 'stock_in' && (
                  <>
                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        Product <span className="inv-required">*</span>
                      </label>
                      <select
                        className="inv-form-control"
                        value={productId}
                        onChange={(e) => setProductId(e.target.value)}
                        required
                      >
                        <option value="">Select product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.sku ? `(${p.sku})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        Warehouse <span className="inv-required">*</span>
                      </label>
                      <select
                        className="inv-form-control"
                        value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value)}
                        required
                      >
                        <option value="">Select warehouse</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        Quantity <span className="inv-required">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="inv-form-control"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder=""
                        required
                      />
                    </div>

                    <div className="inv-form-group">
                      <label className="inv-form-label">Reference Number</label>
                      <input
                        type="text"
                        className="inv-form-control"
                        placeholder="e.g., PO-12345 or SO-67890"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                      />
                    </div>

                    <div className="inv-form-group">
                      <label className="inv-form-label">Notes</label>
                      <textarea
                        className="inv-form-control"
                        placeholder="Add any additional notes..."
                        rows="3"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      ></textarea>
                    </div>

                    <div className="inv-modal-footer">
                      <button
                        type="button"
                        className="inv-btn-cancel"
                        onClick={closeModal}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inv-btn-submit inv-btn-submit-green"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Processing...' : 'Confirm Stock In'}
                      </button>
                    </div>
                  </>
                )}

                {/* 2. STOCK OUT FORM */}
                {activeTab === 'stock_out' && (
                  <>
                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        Product <span className="inv-required">*</span>
                      </label>
                      <select
                        className="inv-form-control"
                        value={productId}
                        onChange={(e) => setProductId(e.target.value)}
                        required
                      >
                        <option value="">Select product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.sku ? `(${p.sku})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        Warehouse <span className="inv-required">*</span>
                      </label>
                      <select
                        className="inv-form-control"
                        value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value)}
                        required
                      >
                        <option value="">Select warehouse</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        Quantity <span className="inv-required">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="inv-form-control"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder=""
                        required
                      />
                    </div>

                    <div className="inv-form-group">
                      <label className="inv-form-label">Reference Number</label>
                      <input
                        type="text"
                        className="inv-form-control"
                        placeholder="e.g., PO-12345 or SO-67890"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                      />
                    </div>

                    <div className="inv-form-group">
                      <label className="inv-form-label">Notes</label>
                      <textarea
                        className="inv-form-control"
                        placeholder="Add any additional notes..."
                        rows="3"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      ></textarea>
                    </div>

                    <div className="inv-modal-footer">
                      <button
                        type="button"
                        className="inv-btn-cancel"
                        onClick={closeModal}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inv-btn-submit inv-btn-submit-red"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Processing...' : 'Confirm Stock Out'}
                      </button>
                    </div>
                  </>
                )}

                {/* 3. TRANSFER FORM */}
                {activeTab === 'transfer' && (
                  <>
                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        Product <span className="inv-required">*</span>
                      </label>
                      <select
                        className="inv-form-control"
                        value={productId}
                        onChange={(e) => setProductId(e.target.value)}
                        required
                      >
                        <option value="">Select product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.sku ? `(${p.sku})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        From Warehouse <span className="inv-required">*</span>
                      </label>
                      <select
                        className="inv-form-control"
                        value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value)}
                        required
                      >
                        <option value="">Select source warehouse</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        To Warehouse <span className="inv-required">*</span>
                      </label>
                      <select
                        className="inv-form-control"
                        value={toWarehouseId}
                        onChange={(e) => setToWarehouseId(e.target.value)}
                        required
                      >
                        <option value="">Select destination warehouse</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        Quantity <span className="inv-required">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="inv-form-control"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder=""
                        required
                      />
                    </div>

                    <div className="inv-form-group">
                      <label className="inv-form-label">Reference Number</label>
                      <input
                        type="text"
                        className="inv-form-control"
                        placeholder="e.g., PO-12345 or SO-67890"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                      />
                    </div>

                    <div className="inv-form-group">
                      <label className="inv-form-label">Notes</label>
                      <textarea
                        className="inv-form-control"
                        placeholder="Add any additional notes..."
                        rows="3"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      ></textarea>
                    </div>

                    <div className="inv-modal-footer">
                      <button
                        type="button"
                        className="inv-btn-cancel"
                        onClick={closeModal}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inv-btn-submit inv-btn-submit-blue"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Processing...' : 'Confirm Transfer'}
                      </button>
                    </div>
                  </>
                )}

                {/* 4. ADJUST FORM */}
                {activeTab === 'adjust' && (
                  <>
                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        Product <span className="inv-required">*</span>
                      </label>
                      <select
                        className="inv-form-control"
                        value={productId}
                        onChange={(e) => setProductId(e.target.value)}
                        required
                      >
                        <option value="">Select product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.sku ? `(${p.sku})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        Warehouse <span className="inv-required">*</span>
                      </label>
                      <select
                        className="inv-form-control"
                        value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value)}
                        required
                      >
                        <option value="">Select warehouse</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        New Quantity <span className="inv-required">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="inv-form-control"
                        value={newQuantity}
                        onChange={(e) => setNewQuantity(e.target.value)}
                        placeholder=""
                        required
                      />
                    </div>

                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        Reason <span className="inv-required">*</span>
                      </label>
                      <textarea
                        className="inv-form-control"
                        placeholder="Explain why this adjustment is needed (required for audit)"
                        rows="3"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required
                      ></textarea>
                    </div>

                    <div className="inv-modal-footer">
                      <button
                        type="button"
                        className="inv-btn-cancel"
                        onClick={closeModal}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inv-btn-submit inv-btn-submit-orange"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Processing...' : 'Confirm Adjust Inventory'}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
