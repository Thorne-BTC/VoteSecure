import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import CompanyManager from './components/CompanyManager';
import VoteManager from './components/VoteManager';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<'company' | 'vote'>('company');

  return (
    <div className="App">
      <header className="App-header">
        <h1>🔒 VoteSecure</h1>
        <p>公司内部保密投票系统</p>
        <ConnectButton />
      </header>

      <nav className="tabs">
        <button 
          className={activeTab === 'company' ? 'active' : ''}
          onClick={() => setActiveTab('company')}
        >
          公司管理
        </button>
        <button 
          className={activeTab === 'vote' ? 'active' : ''}
          onClick={() => setActiveTab('vote')}
        >
          投票管理
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'company' ? <CompanyManager /> : <VoteManager />}
      </main>
    </div>
  );
}

export default App
