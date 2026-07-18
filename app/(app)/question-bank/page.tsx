'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Question bank now has a dedicated browse page
export default function QuestionBankRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/question-bank/browse');
  }, [router]);
  return null;
}
