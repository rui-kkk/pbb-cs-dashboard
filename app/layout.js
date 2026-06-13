import './globals.css';

export const metadata = {
  title: 'PBB CS Dashboard',
  description: 'PUBG Black Budget Alpha Test CS Dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}