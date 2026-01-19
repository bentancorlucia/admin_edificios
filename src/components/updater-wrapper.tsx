'use client';

import dynamic from 'next/dynamic';

const Updater = dynamic(() => import('./updater').then((mod) => mod.Updater), {
  ssr: false,
});

export function UpdaterWrapper() {
  return <Updater />;
}
