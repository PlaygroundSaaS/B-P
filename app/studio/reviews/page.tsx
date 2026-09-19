import Link from 'next/link';
import { hasStudioSession } from '@/lib/studio-auth';
import StudioLoginForm from '../login-form';
import ReviewManager from './review-manager';
export const dynamic='force-dynamic';
export const metadata={title:'Client reviews · Studio',robots:{index:false,follow:false}};
export default async function Page(){if(!await hasStudioSession())return <StudioLoginForm/>;return <div className="public-site"><main className="public-review-manager public-wrap"><Link className="public-text-link" href="/studio#settings">← Back to Business Studio</Link><p className="public-kicker">YOUR WEBSITE</p><h1>Client reviews.</h1><p className="public-copy">Create a personal link, copy it and send it to your client. Their review is published automatically after they agree to share it.</p><ReviewManager/></main></div>}
