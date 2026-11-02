async function setGlobalLoading(isLoading) {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.disabled = isLoading;
        if (isLoading) {
            button.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            button.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });
}