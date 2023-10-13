import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import bootstrap from 'bootstrap';

const title = 'Automatic Furucombo';

ReactDOM.render(
  <App title={title} />,
  document.getElementById('app')
);

module.hot.accept();
