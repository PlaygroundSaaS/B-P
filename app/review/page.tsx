import { PublicPage } from '../public/components';
import ReviewForm from './review-form';
export const metadata={title:'Share your experience',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default function Page(){return <PublicPage><section className="public-review-form public-wrap"><p className="public-kicker">THANK YOU FOR CHOOSING BRAMBLE & PETAL</p><h1>How were your flowers?</h1><p className="public-copy">Your experience matters. Share a few words for other clients considering flowers with us.</p><ReviewForm/></section></PublicPage>}
