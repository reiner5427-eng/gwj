import type { Metadata } from 'next';
export const metadata: Metadata = { title: '우리 반 졸업앨범 한마디 💌', description: '26명의 친구들이 함께 남기는 졸업앨범 한마디', robots:{index:false,follow:false} };
export default function RootLayout({children}: Readonly<{children:React.ReactNode}>) {return <html lang="ko"><body>{children}</body></html>}
