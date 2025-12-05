'use client';

const RevalidateButton = () => {
    return (
        <button onClick={() => fetch('/api/revalidate')}>
            Revalidate this page
        </button>
    )
}

export default RevalidateButton;
