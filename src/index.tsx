import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

import { App } from './components/App/App';
import { ToastsContextProvider } from './contexts/ToastsContext';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

// TODO: wrap to React.StrictMode after moving all business logic out of rendering
root.render(<HashRouter>
    <ToastsContextProvider>
        <App/>
    </ToastsContextProvider>
</HashRouter>);
