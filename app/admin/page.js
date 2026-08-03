'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import RequestsTab from './RequestsTab';
import ClientsTab from './ClientsTab';

export default function AdminPage() {
  const [tab, setTab] = useState('requests');

  return (
    <div className="app admin-app">
      <header className="header">
        <h1>Sarvam Associates — Admin</h1>
        <div className="header-actions">
          <Link className="clear-btn" href="/">Chat →</Link>
          <button className="clear-btn" type="button" onClick={() => signOut({ callbackUrl: '/' })}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={`tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
          Service Requests
        </button>
        <button className={`tab ${tab === 'clients' ? 'active' : ''}`} onClick={() => setTab('clients')}>
          Client Data
        </button>
      </nav>

      {tab === 'requests' ? <RequestsTab /> : <ClientsTab />}
    </div>
  );
}
