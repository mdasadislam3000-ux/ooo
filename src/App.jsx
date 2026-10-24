import React, { useEffect, useState } from 'react';
import { products } from '../shared/catalog.js';
import { defaultSiteSettings } from '../shared/siteSettings.js';
import brandLogo from '../source/asad-topup-logo.png';
import uidProductLogo from '../source/uid.png';

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  let data = null;
  if (response.status !== 204) {
    const body = await response.text();
    if (body) {
      try {
        data = JSON.parse(body);
      } catch {
        const message = response.ok
          ? 'The server returned an invalid response. Please restart the API server and try again.'
          : `The server could not complete the request (HTTP ${response.status}). Please try again.`;
        throw new Error(message);
      }
    } else if (!response.ok) {
      throw new Error(`The server could not complete the request (HTTP ${response.status}). Please try again.`);
    } else {
      throw new Error('The server returned an empty response. Please restart the API server and check your orders before retrying.');
    }
  }
  if (!response.ok) {
    const message = data?.error || 'Request failed. Please try again.';
    if (message === 'API endpoint not found.' && path.startsWith('/api/admin/')) {
      throw new Error('This API server does not have the admin routes loaded. Stop and restart the API server, then try again.');
    }
    throw new Error(message);
  }
  return data;
}

function Promo({ children }) {
  return children.split('\n').map((line, index) => <React.Fragment key={`${line}-${index}`}>{index > 0 && <br />}{line}</React.Fragment>);
}

function Logo({ onClick, brandName = 'Asad Topup' }) {
  const [first, ...rest] = brandName.trim().split(/\s+/);
  return <button className="logo" type="button" onClick={onClick} aria-label={`${brandName} home`}><img className="logo-image" src={brandLogo} alt="" /><span className="logo-text"><strong>{first || 'Asad'}</strong><span>{rest.join(' ')}</span></span></button>;
}

function Header({ user, navigate, onLogout, brandName }) {
  return <header><nav className="nav"><Logo brandName={brandName} onClick={() => navigate('home')} /><div className="nav-links"><button onClick={() => navigate('home')}>Shop</button>{user ? <><button className="profile-btn" onClick={() => navigate('account')}><span className="profile-avatar" aria-hidden="true">{(user.name || user.email).slice(0, 1).toUpperCase()}</span>Profile</button><button className="nav-btn" onClick={onLogout}>Sign out</button></> : <><button className="login-nav-btn" onClick={() => navigate('login')}>Log in</button><button className="nav-btn" onClick={() => navigate('login')}>Create account</button></>}</div></nav></header>;
}

function Home({ onSelect, onAccount, user, products, siteSettings }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const categories = [
    ['all', 'All products'],
    ['diamonds', 'Diamond top ups'],
    ['passes', 'Passes'],
    ['boosts', 'Social boosts'],
  ];
  const filteredProducts = products.filter((product) => {
    const productCategory = product.id === 'uid-bd' ? 'diamonds' : product.id === 'ff-like' ? 'boosts' : 'passes';
    const matchesCategory = category === 'all' || productCategory === category;
    const matchesQuery = `${product.name} ${product.tag} ${product.promo}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return <section className="view active home-view">
    <div className="home-hero">
      <div className="home-hero-copy">
        <span className="welcome-eyebrow"><span className="live-dot" /> {siteSettings.heroEyebrow}</span>
        <h1 className="hero-title">{siteSettings.heroTitleFirst}<br /><em>{siteSettings.heroTitleSecond}</em></h1>
        <p>{siteSettings.heroDescription}</p>
        <div className="hero-actions"><a className="hero-primary" href="#shop">{siteSettings.heroPrimaryLabel} <span aria-hidden="true">&#8595;</span></a><button className="hero-secondary" onClick={user ? onAccount : () => document.querySelector('.nav-btn')?.click()}>{user ? 'View my orders' : siteSettings.heroSecondaryLabel}</button></div>
        <div className="hero-proof"><span><strong>{products.length}</strong> top-up products</span><span><strong>{products.reduce((total, product) => total + product.packages.length, 0)}</strong> available packages</span></div>
      </div>
      <div className="hero-art" aria-label="Asad Topup game credit offer">
        <div className="hero-art-label">PLAYER PICK <span>01 / 05</span></div>
        <div className="hero-pack"><span className="pack-kicker">LEVEL UP PASS</span><strong>Play<br />your way.</strong><span className="pack-stamp">ASAD<br />TOPUP</span></div>
        <div className="hero-art-note"><span className="note-mark">&#10003;</span><span><strong>Order saved</strong><small>Track it in your account</small></span></div>
        <span className="hero-art-index">A / TOP UP</span>
      </div>
    </div>

    <div className="service-strip">{siteSettings.services.map((service, index) => <div key={`${service.title}-${index}`}><span className="service-icon">{String(index + 1).padStart(2, '0')}</span><span><strong>{service.title}</strong><small>{service.description}</small></span></div>)}</div>

    <section className="shop-section" id="shop">
      <div className="shop-heading"><div><span className="section-kicker">{siteSettings.catalogEyebrow}</span><h2>{siteSettings.catalogTitle}</h2></div><p>{siteSettings.catalogDescription}</p></div>
      <div className="catalog-tools"><label className="catalog-search"><span aria-hidden="true">&#8981;</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products..." aria-label="Search products" /></label><div className="catalog-filters" role="group" aria-label="Filter products">{categories.map(([id, label]) => <button key={id} type="button" className={category === id ? 'active' : ''} aria-pressed={category === id} onClick={() => setCategory(id)}>{label}</button>)}</div></div>
      <div className="catalog-count">{filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} <span>·</span> priced in Bangladeshi taka</div>
      <div className="product-grid !grid-cols-1 !gap-3 sm:!grid-cols-2 sm:!gap-4 lg:!grid-cols-3 2xl:!grid-cols-4 tv:!grid-cols-5 tv:!gap-6">{filteredProducts.map((product) => {
        const startingPrice = Math.min(...product.packages.map(([, price]) => price));
        return <article className="product-card" key={product.id}><div className={`product-visual ${product.visual}`}>{product.id === 'uid-bd' ? <img className="uid-product-logo" src={uidProductLogo} alt="Free Fire UID top up — Asad Top Up" /> : <><div className="mini-mark"><span>Asad</span></div><div className="promo-text"><Promo>{product.promo}</Promo></div><span className="product-stamp">{product.tag}</span></>}</div><div className="product-meta"><div className="product-name-row"><p className="product-name">{product.name}</p><span className="package-count">{product.packages.length} packs</span></div><span className="product-from">From <strong>&#2547; {startingPrice}</strong></span><button className="card-action" onClick={() => onSelect(product)}>Choose package <span aria-hidden="true">&#8599;</span></button></div></article>;
      })}{filteredProducts.length === 0 && <div className="catalog-empty"><strong>No matching top ups</strong><span>Try a different search or category.</span></div>}</div>
    </section>
  </section>;
}

function Footer({ navigate, user, siteSettings }) {
  return <footer className="site-footer"><div className="footer-main"><div className="footer-brand"><Logo brandName={siteSettings.brandName} onClick={() => navigate('home')} /><p>{siteSettings.footerDescription}</p></div><div className="footer-column"><strong>Explore</strong><button onClick={() => navigate('home')}>Top-up catalogue</button>{user && <button onClick={() => navigate('account')}>My orders</button>}</div><div className="footer-column"><strong>Order information</strong><span>Orders require manual confirmation.</span><span>Online payments are not available.</span></div><div className="footer-column"><strong>Your account</strong><button onClick={() => navigate(user ? 'account' : 'login')}>{user ? 'Account & orders' : 'Create account or sign in'}</button><button onClick={() => navigate('admin-login')}>Admin panel</button></div></div><div className="footer-bottom"><span>&#169; {new Date().getFullYear()} {siteSettings.brandName}</span><span>Prices shown in BDT &#183; Orders saved securely to your account</span></div></footer>;
}

function Login({ onAuthenticate, initialMessage }) {
  const [mode, setMode] = useState('register');
  const [error, setError] = useState('');
  const [googleNotice, setGoogleNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await onAuthenticate({ name: form.get('name'), email: form.get('email'), password: form.get('password') }, mode);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="view active"><div className="login-wrap"><div className="welcome-box"><span className="welcome-eyebrow">Your Asad Topup account</span><h1 className="welcome-title">Welcome <span className="accent">Back</span></h1><p className="welcome-copy">Create an account to place and track top-up orders, or sign in to continue.</p><div className="mini-device" aria-hidden="true"><div className="device-screen" /></div></div><div className="login-options"><div className="google-login-card"><div className="google-brand-mark" aria-hidden="true"><GoogleMark /></div><h2>Login With Google</h2><p>One-click sign in with your Google account</p><button className="google-login-button" type="button" onClick={() => setGoogleNotice('Google sign-in is not configured yet. Use email sign-in below.') }><span className="google-button-mark"><GoogleMark /></span><span>Continue with Google</span></button><div className="google-divider"/><div className="google-benefits"><div><span className="benefit-icon secure">&#10003;</span><span>Secure</span></div><div><span className="benefit-icon fast">&#9889;</span><span>Fast</span></div><div><span className="benefit-icon private">&#128274;</span><span>Private</span></div></div>{googleNotice && <p className="google-notice" role="status">{googleNotice}</p>}</div><form className="auth-card" onSubmit={submit}><div className="auth-header"><div className="auth-icon" aria-hidden="true">&#128274;</div><div><h2 className="auth-title">{mode === 'register' ? 'Create your account' : 'Sign in to continue'}</h2><p className="auth-sub">{mode === 'register' ? 'One account for your orders and order history' : 'Use the email and password for your account'}</p></div></div>{initialMessage && <p className="form-message">{initialMessage}</p>}{mode === 'register' && <div className="field"><label htmlFor="name">Full name</label><div className="input-wrap"><input id="name" name="name" type="text" placeholder="Your name" autoComplete="name" maxLength="80" required /></div></div>}<div className="field"><label htmlFor="email">Email address</label><div className="input-wrap"><span className="icon" aria-hidden="true">&#9993;</span><input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" maxLength="254" required /></div></div><div className="field"><label htmlFor="password">Password</label><div className="input-wrap"><span className="icon" aria-hidden="true">&#128274;</span><input id="password" name="password" type="password" placeholder="At least 8 characters" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength="8" maxLength="128" required /></div></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="submit-btn" type="submit" disabled={busy}>{busy ? 'Please wait...' : mode === 'register' ? 'Create account' : 'Sign in'}</button><p className="auth-switch">{mode === 'register' ? 'Already have an account?' : 'New to Asad Topup?'} <button type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>{mode === 'register' ? 'Sign in' : 'Create account'}</button></p><div className="secure-note">Passwords are stored as secure hashes. Your account is private.</div></form></div></div></section>;
}

function GoogleMark() {
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z"/><path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.9 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z"/></svg>;
}

function Account({ user, orders, onLogout, onShop }) {
  const totalSpent = orders.filter((order) => order.status === 'completed').reduce((total, order) => total + order.amount, 0);
  return <section className="view active"><div className="account-page"><div className="account-wrap"><div className="account-header"><div className="user-box"><div className="avatar">{user.email.slice(0, 1).toUpperCase()}</div><div><h1 className="user-name">My account <span className="verified">&#10003; Signed in</span></h1><div className="meta-row"><span>{user.name || user.email.split('@')[0]}</span><span>{user.email}</span><span>Member since {new Date(user.createdAt).toLocaleDateString()}</span></div></div></div><div className="wallet-box"><div className="wallet-title"><span>Wallet balance</span><span aria-hidden="true">&#9711;</span></div><div className="wallet-balance">&#2547; {user.walletBalance || 0}</div><button className="wallet-btn" onClick={onShop}>Shop products</button><small className="wallet-help">Ask an admin to add wallet funds.</small></div></div><div className="rank-panel"><div className="rank-row"><div className="rank-badge" aria-hidden="true">&#128230;</div><div className="rank-info"><div className="rank-sub">Account summary</div><h2 className="rank-name">Order history</h2></div></div><div className="rank-sub">Orders are saved to your account. Payment is not collected on this site.</div><div className="progress-label"><span>Completed purchases</span><span>{totalSpent} Tk</span></div><div className="progress"><div className="progress-bar" style={{ width: totalSpent ? '40%' : '0%' }} /></div></div><div className="orders-heading"><h2>Your orders</h2><button className="account-logout" onClick={onLogout}>Sign out</button></div>{orders.length ? <div className="account-orders">{orders.map((order) => <article className="account-order" key={order.id}><div><strong>{order.productName}</strong><span>{order.packageName} · Player ID {order.playerId}</span><small>Payment: {order.paymentMethod === 'wallet' ? 'Wallet' : order.paymentMethod === 'bkash_demo' ? 'bKash (Demo)' : 'Manual'} · {order.paymentStatus}</small><small>Order #{order.id.slice(0, 8)} · {new Date(order.createdAt + 'Z').toLocaleString()}</small></div><div className="order-side"><strong>&#2547; {order.amount}</strong><span className={`order-status status-${order.status}`}>{order.status === 'pending' ? 'Pending' : order.status}</span></div></article>)}</div> : <div className="orders-empty"><strong>No orders yet</strong><span>Your orders will appear here after you place one.</span><button className="card-action" onClick={onShop}>Browse top-ups</button></div>}</div></div></section>;
}

function Checkout({ product, onCreateOrder, walletBalance = 0 }) {
  const [packageIndex, setPackageIndex] = useState(null);
  const [playerId, setPlayerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('manual');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const selectedPackage = packageIndex === null ? null : product.packages[packageIndex];

  async function placeOrder() {
    setNotice('');
    if (!selectedPackage) return setNotice('Select a recharge package to continue.');
    if (playerId.trim().length < 3) return setNotice('Enter a valid player ID to continue.');
    setBusy(true);
    try {
      const order = await onCreateOrder({ productId: product.id, packageName: selectedPackage[0], playerId, paymentMethod });
      setNotice(paymentMethod === 'wallet' ? `Order #${order.id.slice(0, 8)} placed and automatically moved to processing. Paid from your wallet.` : paymentMethod === 'bkash_demo' ? `Order #${order.id.slice(0, 8)} placed and moved to processing. Demo only; no real money was transferred.` : `Order #${order.id.slice(0, 8)} placed and automatically moved to processing.`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="view active"><div className="checkout-page"><div className="checkout-banner"><div className="checkout-icon"><Promo>{product.promo}</Promo></div><div><h1 className="checkout-heading">{product.name.toUpperCase()}</h1><span className="delivery-pill">Order request · No online payment</span></div></div><div className="checkout-grid"><div><section className="checkout-panel"><h2 className="panel-title"><span className="step-number">1</span>Select Recharge</h2><div className="recharge-options" role="group" aria-label="Select a recharge package">{product.packages.map(([name, price], index) => <button type="button" className={`recharge-option ${packageIndex === index ? 'selected' : ''}`} key={`${name}-${index}`} aria-pressed={packageIndex === index} onClick={() => { setPackageIndex(index); setNotice(''); }}><span className="radio-dot" aria-hidden="true" /><span className="recharge-name">{name}</span><span className="recharge-price">{price} Tk</span></button>)}</div></section></div><aside><section className="checkout-panel"><h2 className="panel-title"><span className="step-number">2</span>Account Info</h2><div className="account-fields"><label htmlFor="playerId">{product.label}</label><div className="player-entry"><input id="playerId" value={playerId} onChange={(event) => setPlayerId(event.target.value)} type="text" inputMode="numeric" placeholder={product.label} autoComplete="off" /></div><p className="stock-note">Order status: <strong>Automatically processing after checkout</strong></p></div></section><section className="checkout-panel"><h2 className="panel-title"><span className="step-number">3</span>Payment method</h2><div className="payment-methods"><button type="button" className="payment-method" aria-pressed={paymentMethod === "wallet"} onClick={setPaymentMethod.bind(null, "wallet")} disabled={walletBalance < (selectedPackage?.[1] || 0)}>Wallet balance · &#2547; {walletBalance}</button><button type="button" className="payment-method" aria-pressed={paymentMethod === "manual"} onClick={setPaymentMethod.bind(null, "manual")}>Pay later · manual payment</button><button type="button" className="payment-method bkash-demo-option" aria-pressed={paymentMethod === "bkash_demo"} onClick={setPaymentMethod.bind(null, "bkash_demo")}>bKash <span className="demo-badge">DEMO</span></button></div>{paymentMethod === 'bkash_demo' && <p className="demo-payment-note">Demo mode only. This simulates a successful bKash payment; no real payment is processed.</p>}{selectedPackage && walletBalance < selectedPackage[1] && <p className="wallet-shortfall">Wallet balance is too low for this package.</p>}</section><section className="checkout-panel"><h2 className="panel-title"><span className="step-number">4</span>Review order</h2><div className="checkout-summary"><p>Selected package <strong>{selectedPackage ? selectedPackage[0] : 'Choose a package'}</strong></p><p>Order total <strong>{selectedPackage ? `&#2547; ${selectedPackage[1]}` : 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â'}</strong></p><p className="payment-disclaimer">{paymentMethod === "wallet" ? "Your wallet will be charged when you place this order." : paymentMethod === "bkash_demo" ? "Demo only: this simulates bKash success. No real money moves." : "No payment is collected now. Your order starts processing automatically."}</p><button type="button" className="buy-button" onClick={placeOrder} disabled={busy}>{busy ? 'Placing order...' : paymentMethod === 'wallet' ? 'Pay with wallet' : paymentMethod === 'bkash_demo' ? 'Simulate bKash payment' : 'Place order'}</button><p className="checkout-notice" aria-live="polite">{notice}</p></div></section></aside></div><section className="checkout-panel rules-panel"><h2 className="panel-title">Order information</h2><div className="rules-copy">{paymentMethod === 'wallet' ? 'Your wallet is charged immediately. Top-ups still require admin delivery.' : paymentMethod === 'bkash_demo' ? 'Demo payment only: no bKash account or real payment is used.' : 'Make sure your player ID is correct. Your order starts processing automatically without charging you now.'}</div></section></div></section>;
}

function AdminLogin({ onLogin }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    try { await onLogin({ username: form.get('username'), password: form.get('password') }); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <section className="view active"><div className="admin-login-wrap"><form className="auth-card admin-login-card" onSubmit={submit}><span className="section-kicker">ASAD TOPUP · CONTROL CENTER</span><h1 className="admin-title">Admin sign in</h1><p className="auth-sub">Secure access to your orders, products, and customer records.</p><div className="field"><label htmlFor="admin-user">Username</label><input className="admin-input" id="admin-user" name="username" autoComplete="username" autoCapitalize="none" required /></div><div className="field"><label htmlFor="admin-pass">Password</label><input className="admin-input" id="admin-pass" name="password" type="password" autoComplete="current-password" required /></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="submit-btn admin-login-submit" disabled={busy}>{busy ? 'Signing inâ€¦' : 'Sign in to admin'}</button><p className="admin-login-foot">Admin access is protected with a separate session.</p></form></div></section>;
}

function AdminDashboard({ onLogout, catalog, onSaveCatalog, siteSettings, onSaveSiteSettings }) {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [catalogDraft, setCatalogDraft] = useState(catalog);
  const [siteDraft, setSiteDraft] = useState(siteSettings);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  async function refresh() { setData(await api('/api/admin/overview')); }
  useEffect(() => { refresh().catch((e) => setError(e.message)); }, []);
  useEffect(() => { setCatalogDraft(catalog); }, [catalog]);
  useEffect(() => { setSiteDraft(siteSettings); }, [siteSettings]);
  async function setStatus(order, status) {
    setError(''); setNotice('');
    try { await api(`/api/admin/orders/${order.id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await refresh(); setNotice(`Order #${order.id.slice(0, 8)} updated.`); }
    catch (e) { setError(e.message); }
  }
  async function saveCatalog() {
    setError(''); setNotice('');
    try { await onSaveCatalog(catalogDraft); setNotice('Catalog saved to the storefront.'); }
    catch (e) { setError(e.message); }
  }
  async function saveSiteSettings() {
    setError(''); setNotice('');
    try { await onSaveSiteSettings(siteDraft); setNotice('Site content saved and published.'); }
    catch (e) { setError(e.message); }
  }
  async function creditWallet(customerId, amount) {
    setError(''); setNotice('');
    try {
      const result = await api(`/api/admin/customers/${customerId}/wallet`, { method: 'POST', body: JSON.stringify({ amount, note: 'Admin wallet credit' }) });
      await refresh();
      setNotice(`Wallet credited. New balance: &#2547; ${result.walletBalance}.`);
    } catch (e) { setError(e.message); }
  }
  function addProduct() {
    setError(''); setNotice('');
    const id = `new-product-${Date.now()}`;
    const newProduct = { id, name: 'New product', tag: 'New', visual: 'visual-voucher', promo: 'New\nProduct', label: 'Player ID', packages: [['New package', 0]] };
    setCatalogDraft((current) => [...current, newProduct]);
    setNotice('Product added. Complete its details, then save the catalog.');
    requestAnimationFrame(() => {
      const card = document.querySelector(`[data-product-id="${id}"]`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card?.querySelector('input')?.focus({ preventScroll: true });
    });
  }
  const visibleOrders = (data?.orders || []).filter((order) => {
    const search = orderSearch.trim().toLowerCase();
    const matchesSearch = !search || [order.customerName, order.email, order.playerId, order.productName, order.packageName, order.id].some((value) => String(value || '').toLowerCase().includes(search));
    return matchesSearch && (orderStatusFilter === 'all' || order.status === orderStatusFilter);
  });
  return <section className="view active"><div className="admin-shell"><div className="admin-header"><div><span className="section-kicker">CONTROL CENTER</span><h1 className="admin-title">Admin panel</h1><p>Manage customers, confirm orders, and update your storefront.</p></div><button className="account-logout" onClick={onLogout}>Sign out</button></div><div className="admin-layout"><nav className="admin-nav" aria-label="Admin sections">{[['overview','Overview'],['orders','Orders'],['site','Site content'],['catalog','Catalog'],['customers','Customers']].map(([id,label]) => <button key={id} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{label}</button>)}</nav><div className="admin-content">{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-message" role="status">{notice}</p>}{!data && <p>Loading admin data...</p>}{data && tab === 'overview' && <><h2>Store overview</h2><div className="admin-stats"><article><span>Customers</span><strong>{data.stats.customers}</strong></article><article><span>Orders</span><strong>{data.stats.orders}</strong></article><article><span>Active orders</span><strong>{data.stats.active}</strong></article><article><span>Completed value</span><strong>৳ {data.stats.completedTotal}</strong></article><article><span>Wallet funds</span><strong>৳ {data.stats.walletLiability}</strong></article></div><h3>Latest orders</h3><AdminOrders orders={data.orders.slice(0, 8)} onStatus={setStatus} /></>}{data && tab === 'orders' && <><div className="admin-section-heading"><div><h2>Orders</h2><p>Orders enter processing automatically. Update their status after delivery or cancellation.</p></div><span className="admin-order-count">{visibleOrders.length} orders</span></div><div className="admin-order-tools"><input aria-label="Search customer and orders" type="search" placeholder="Search name, email, player ID, product..." value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} /><select aria-label="Filter orders by status" value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="pending">Needs confirmation</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div><AdminOrders orders={visibleOrders} onStatus={setStatus} /></>}{data && tab === 'customers' && <AdminCustomers customers={data.customers} onCredit={creditWallet} />}{data && tab === 'site' && <SiteContentEditor settings={siteDraft} onChange={setSiteDraft} onSave={saveSiteSettings} />}{data && tab === 'catalog' && <><h2>Edit catalog</h2><p>Manage products and package prices shown on your storefront.</p><div className="catalog-actions"><button className="account-logout" type="button" onClick={addProduct}>+ Add product</button><button className="admin-save" onClick={saveCatalog}>Save catalog</button></div><CatalogEditor products={catalogDraft} onChange={setCatalogDraft} /></>}</div></div></div></section>;
}

function AdminCustomers({ customers, onCredit }) {
  return <><h2>Customer wallets</h2><p>Credit wallet funds here. Customers can use their balance to pay at checkout.</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Customer</th><th>Joined</th><th>Orders</th><th>Wallet balance</th><th>Add funds (BDT)</th></tr></thead><tbody>{customers.map((customer) => <AdminCustomerRow key={customer.id} customer={customer} onCredit={onCredit} />)}</tbody></table>{!customers.length && <p className="admin-empty">No customers yet.</p>}</div></>;
}

function AdminCustomerRow({ customer, onCredit }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value < 1) return;
    setBusy(true);
    try { await onCredit(customer.id, value); setAmount(''); }
    finally { setBusy(false); }
  }
  return <tr><td><strong>{customer.name || customer.email.split('@')[0]}</strong><small>{customer.email}</small></td><td>{new Date(customer.createdAt + 'Z').toLocaleDateString()}</td><td>{customer.orderCount}</td><td><strong>&#2547; {customer.walletBalance}</strong></td><td><form className="wallet-credit-form" onSubmit={submit}><input aria-label={`Amount to add for ${customer.email}`} type="number" min="1" max="100000000" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required /><button className="admin-save" disabled={busy}>{busy ? 'Addingâ€¦' : 'Add funds'}</button></form></td></tr>;
}

function SiteContentEditor({ settings, onChange, onSave }) {
  const textFields = [
    ['brandName', 'Site name'], ['locationLabel', 'Location label'], ['heroEyebrow', 'Hero eyebrow'],
    ['heroTitleFirst', 'Hero headline line 1'], ['heroTitleSecond', 'Hero headline line 2'],
    ['heroPrimaryLabel', 'Main button text'], ['heroSecondaryLabel', 'Secondary button text'],
    ['catalogEyebrow', 'Shop section label'], ['catalogTitle', 'Shop section heading'],
  ];
  return <div className="site-content-editor"><div className="admin-section-intro"><div><h2>Site content</h2><p>Edit the text and highlights visitors see on your storefront.</p></div><button className="admin-save" type="button" onClick={onSave}>Save site changes</button></div>
    <section className="site-settings-card"><h3>Brand and homepage</h3><div className="site-settings-grid">{textFields.map(([key, label]) => <label key={key}>{label}<input value={settings[key]} onChange={(e) => onChange({ ...settings, [key]: e.target.value })} maxLength="500" /></label>)}
      <label className="site-settings-wide">Hero description<textarea value={settings.heroDescription} onChange={(e) => onChange({ ...settings, heroDescription: e.target.value })} maxLength="500" rows="3" /></label>
      <label className="site-settings-wide">Shop section description<textarea value={settings.catalogDescription} onChange={(e) => onChange({ ...settings, catalogDescription: e.target.value })} maxLength="500" rows="3" /></label>
    </div></section>
    <section className="site-settings-card"><div className="admin-section-intro"><div><h3>Service highlights</h3><p>These three items appear below the homepage banner.</p></div><button className="account-logout" type="button" onClick={() => settings.services.length < 6 && onChange({ ...settings, services: [...settings.services, { title: 'New highlight', description: 'Describe this service' }] })}>+ Add highlight</button></div>
      <div className="site-service-list">{settings.services.map((service, index) => <div className="site-service-row" key={`service-${index}`}><label>Title<input value={service.title} onChange={(e) => onChange({ ...settings, services: settings.services.map((item, i) => i === index ? { ...item, title: e.target.value } : item) })} maxLength="80" /></label><label>Description<input value={service.description} onChange={(e) => onChange({ ...settings, services: settings.services.map((item, i) => i === index ? { ...item, description: e.target.value } : item) })} maxLength="160" /></label><button className="admin-remove" type="button" disabled={settings.services.length <= 1} onClick={() => onChange({ ...settings, services: settings.services.filter((_, i) => i !== index) })}>Remove</button></div>)}</div>
    </section>
    <section className="site-settings-card"><h3>Footer and theme</h3><div className="site-settings-grid"><label className="site-settings-wide">Footer description<textarea value={settings.footerDescription} onChange={(e) => onChange({ ...settings, footerDescription: e.target.value })} maxLength="500" rows="3" /></label><label>Accent color<input className="site-color-input" type="color" value={settings.accentColor} onChange={(e) => onChange({ ...settings, accentColor: e.target.value })} /></label></div></section>
  </div>;
}

function CatalogEditor({ products: catalog, onChange }) {
  function updateProduct(index, key, value) {
    onChange(catalog.map((product, i) => i === index ? { ...product, [key]: value } : product));
  }
  function updatePackage(productIndex, packageIndex, part, value) {
    onChange(catalog.map((product, i) => {
      if (i !== productIndex) return product;
      const packages = product.packages.map((item, j) => j === packageIndex ? (part === 0 ? [value, item[1]] : [item[0], value]) : item);
      return { ...product, packages };
    }));
  }
  return <div className="catalog-product-list">{catalog.map((product, index) => <article className="catalog-product-card" data-product-id={product.id} key={product.id}>
    <div className="catalog-product-heading"><div><span>PRODUCT {String(index + 1).padStart(2, '0')}</span><h3>{product.name || 'New product'}</h3></div><button className="admin-remove" type="button" onClick={() => onChange(catalog.filter((_, i) => i !== index))}>Remove product</button></div>
    <div className="catalog-product-fields">
      <label>Product name<input value={product.name} onChange={(e) => updateProduct(index, 'name', e.target.value)} maxLength="120" /></label>
      <label>Badge / tag<input value={product.tag} onChange={(e) => updateProduct(index, 'tag', e.target.value)} maxLength="40" /></label>
      <label>Promo text<input value={product.promo.replace('\n', ' / ')} onChange={(e) => updateProduct(index, 'promo', e.target.value.replace(' / ', '\n'))} maxLength="100" /></label>
      <label>Player ID label<input value={product.label} onChange={(e) => updateProduct(index, 'label', e.target.value)} maxLength="60" /></label>
    </div>
    <div className="catalog-packages-heading"><strong>Recharge packages</strong><button className="admin-add-link" type="button" onClick={() => updateProduct(index, 'packages', [...product.packages, ['New package', 0]])}>+ Add package</button></div>
    <div className="catalog-package-list">{product.packages.map(([name, price], packageIndex) => <div className="catalog-package-row" key={`${product.id}-${packageIndex}`}><input aria-label="Package name" value={name} onChange={(e) => updatePackage(index, packageIndex, 0, e.target.value)} maxLength="100" /><label><span>Price (BDT)</span><input aria-label="Price in taka" type="number" min="0" max="100000000" value={price} onChange={(e) => updatePackage(index, packageIndex, 1, Number(e.target.value))} /></label><button className="admin-remove" type="button" disabled={product.packages.length === 1} onClick={() => updateProduct(index, 'packages', product.packages.filter((_, i) => i !== packageIndex))}>Remove</button></div>)}</div>
  </article>)}{!catalog.length && <p className="admin-empty">No products yet. Click Add product to create one.</p>}</div>;
}

function AdminOrders({ orders, onStatus }) {
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer / Player ID</th><th>Package</th><th>Amount</th><th>Payment</th><th>Delivery status</th></tr></thead><tbody>{orders.map((o) => <tr key={o.id}><td>#{o.id.slice(0,8)}<small>{o.productName} · {new Date(o.createdAt + 'Z').toLocaleDateString()}</small></td><td><strong>{o.customerName || o.email.split('@')[0]}</strong><small>{o.email}</small><small>Player ID: {o.playerId}</small></td><td>{o.packageName}</td><td>&#2547; {o.amount}</td><td>{o.paymentMethod === 'wallet' ? 'Wallet' : o.paymentMethod === 'bkash_demo' ? 'bKash (Demo)' : 'Manual'}<small>{o.paymentStatus}</small></td><td><select aria-label={`Update order ${o.id.slice(0, 8)} status for ${o.customerName || o.email}`} value={o.status} onChange={(e) => onStatus(o,e.target.value)}><option value="pending">Awaiting confirmation</option><option value="processing">Confirmed · Processing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></td></tr>)}</tbody></table>{!orders.length && <p className="admin-empty">No matching orders.</p>}</div>;
}

export default function App() {
  const [view, setView] = useState('home');
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(products[0]);
  const [returnView, setReturnView] = useState('account');
  const [authMessage, setAuthMessage] = useState('');
  const [globalError, setGlobalError] = useState('');
  const [catalog, setCatalog] = useState(products);
  const [siteSettings, setSiteSettings] = useState(defaultSiteSettings);
  const [admin, setAdmin] = useState(null);

  async function refreshOrders() {
    const data = await api('/api/orders');
    setOrders(data.orders);
  }

  useEffect(() => {
    let active = true;
    api('/api/auth/me').then(({ user: currentUser }) => {
      if (!active) return;
      setUser(currentUser);
      return api('/api/orders').then(({ orders: userOrders }) => {
        if (active) setOrders(userOrders);
      });
    }).catch(() => {});
    api('/api/catalog').then(({ products: currentCatalog }) => { if (active) setCatalog(currentCatalog); }).catch(() => {});
    api('/api/site-settings').then(({ settings }) => { if (active) setSiteSettings(settings); }).catch(() => {});
    api('/api/admin/me').then(({ admin: currentAdmin }) => { if (active) { setAdmin(currentAdmin); setView('admin'); } }).catch(() => {});
    return () => { active = false; };
  }, []);

  function navigate(nextView) {
    if (nextView === 'login') {
      setReturnView(user ? 'account' : 'home');
      setAuthMessage('');
    }
    if (nextView === 'detail' && !user) {
      setReturnView('detail');
      setAuthMessage('Create an account or sign in to place your order.');
      setView('login');
      return;
    }
    setView(nextView);
    setGlobalError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function adminLogin(credentials) {
    const result = await api('/api/admin/login', { method: 'POST', body: JSON.stringify(credentials) });
    setAdmin(result.admin); setView('admin'); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function adminLogout() {
    await api('/api/admin/logout', { method: 'POST' }); setAdmin(null); setView('home');
  }
  async function saveCatalog(nextCatalog) {
    const result = await api('/api/admin/catalog', { method: 'PUT', body: JSON.stringify({ products: nextCatalog }) });
    setCatalog(result.products);
  }
  async function saveSiteSettings(nextSettings) {
    const result = await api('/api/admin/site-settings', { method: 'PUT', body: JSON.stringify({ settings: nextSettings }) });
    setSiteSettings(result.settings);
  }

  function selectProduct(product) {
    setSelectedProduct(product);
    if (!user) {
      setReturnView('detail');
      setAuthMessage('Create an account or sign in to place your order.');
      setView('login');
    } else {
      setView('detail');
      api('/api/wallet').then(({ balance }) => {
        setUser((current) => current ? { ...current, walletBalance: balance } : current);
      }).catch(() => {});
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function authenticate(credentials, mode) {
    const { user: signedInUser } = await api(`/api/auth/${mode}`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    setUser(signedInUser);
    setAuthMessage('');
    setGlobalError('');
    await refreshOrders();
    setView(returnView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setOrders([]);
      setView('home');
      setGlobalError('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setGlobalError(error.message);
    }
  }

  async function createOrder(orderDetails) {
    const { order } = await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderDetails),
    });
    if (Number.isSafeInteger(order.walletBalance)) {
      setUser((current) => current ? { ...current, walletBalance: order.walletBalance } : current);
    }
    await refreshOrders();
    return order;
  }

  return <div style={{ '--orange': siteSettings.accentColor }}><Header user={user} navigate={navigate} onLogout={logout} brandName={siteSettings.brandName} /><main className="shell mx-auto w-full !max-w-[1600px] !px-4 !pt-5 !pb-12 sm:!px-6 sm:!pt-8 sm:!pb-16 tv:!px-10 tv:!pt-10">{globalError && <p className="form-error" role="alert">{globalError}</p>}{view === 'home' && <Home user={user} siteSettings={siteSettings} products={catalog} onAccount={() => navigate('account')} onSelect={selectProduct} />}{view === 'login' && <Login key={authMessage} onAuthenticate={authenticate} initialMessage={authMessage} />}{view === 'account' && user && <Account user={user} orders={orders} onLogout={logout} onShop={() => navigate('home')} />}{view === 'detail' && user && <Checkout key={selectedProduct.id} product={catalog.find((product) => product.id === selectedProduct.id) || selectedProduct} walletBalance={user.walletBalance || 0} onCreateOrder={createOrder} />}{view === 'admin-login' && <AdminLogin onLogin={adminLogin} />}{view === 'admin' && admin && <AdminDashboard onLogout={adminLogout} catalog={catalog} onSaveCatalog={saveCatalog} siteSettings={siteSettings} onSaveSiteSettings={saveSiteSettings} />}</main><Footer navigate={navigate} user={user} siteSettings={siteSettings} /></div>;
}

