// Script to update localStorage userId to match DB
console.log('Current userId in localStorage:', localStorage.getItem('glassy_current_user_id'));

// Set to the correct user ID from DB
localStorage.setItem('glassy_current_user_id', 'usr_1');

console.log('Updated userId in localStorage:', localStorage.getItem('glassy_current_user_id'));
console.log('Please refresh the page now.');
