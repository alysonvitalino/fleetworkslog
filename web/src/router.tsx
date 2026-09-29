import { Navigate, createBrowserRouter, type RouteObject } from 'react-router';
import { AppLayout } from './components/layout/AppLayout';
import { NotFoundPage } from './pages/NotFoundPage';
import { TorreDeControlePage } from './pages/operacao/TorreDeControlePage';
import { TransportadoraHomePage } from './pages/transportadora/TransportadoraHomePage';

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/transportadora" replace /> },
      { path: 'transportadora', element: <TransportadoraHomePage /> },
      { path: 'operacao', element: <TorreDeControlePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
