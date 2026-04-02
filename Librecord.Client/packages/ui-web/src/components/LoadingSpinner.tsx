export default function LoadingSpinner() {
    return (
        <div className="flex items-center justify-center h-screen bg-[#2f3136]">
            <div className="relative">
                <div className="w-12 h-12 border-4 border-[#5865F2] border-t-transparent rounded-full animate-spin"></div>
                <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-semibold opacity-70">
                    •••
                </span>
            </div>
        </div>
    );
}
