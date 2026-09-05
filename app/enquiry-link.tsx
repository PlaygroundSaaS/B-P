'use client';
import type { ComponentProps } from 'react';

export default function EnquiryLink({ occasion, children, ...props }: ComponentProps<'a'> & { occasion: string }) {
  return <a {...props} href="#enquire" onClick={() => window.dispatchEvent(new CustomEvent('enquiry-occasion', { detail: occasion }))}>{children}</a>;
}
