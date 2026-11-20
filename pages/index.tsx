import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/errors',
      permanent: false,
    },
  };
};

export default function Home() {
  return null;
}
