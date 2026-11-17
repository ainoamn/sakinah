import type { Metadata } from 'next';
export const metadata:Metadata={title:'سكينة | Sakinah',description:'قرآن وذكر ودعاء بروح عمانية | Quran, dhikr and supplication',icons:{icon:'/site/assets/sakinah-emblem.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body style={{margin:0}}>{children}</body></html>}
