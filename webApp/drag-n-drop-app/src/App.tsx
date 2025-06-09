import React from 'react';
import ItemList from './components/ItemList';
import './App.css'; // Для общих стилей, если нужно

const App: React.FC = () => {
  return (
    <div className="App">
      <ItemList />
    </div>
  );
};

export default App;