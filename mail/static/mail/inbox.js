document.addEventListener('DOMContentLoaded', function () {

    // Use buttons to toggle between views
    document.querySelector('#inbox').addEventListener('click', () => load_mailbox('inbox'));
    document.querySelector('#sent').addEventListener('click', () => load_mailbox('sent'));
    document.querySelector('#archived').addEventListener('click', () => load_mailbox('archive'));
    document.querySelector('#compose').addEventListener('click', compose_email);
    //TODO: should I be able to use 'this'?
    document.querySelector('#read-archive').addEventListener('click', () => {
        const archive_button = document.querySelector('#read-archive');
        toggle_archive_flag(archive_button.dataset.email, archive_button.dataset.archived);
    });
    document.querySelector('#read-reply').addEventListener('click', () => {
        reply_email(document.querySelector('#read-reply').dataset.email);
    });
    // Process form data on submit
    document.querySelector('#compose-form').onsubmit = submit_form;
    // By default, load the inbox
    load_mailbox('inbox');
});

/**
 * Resets and displays the compose email form.
 */
function compose_email() {
    // Show compose view and hide other views
    show_view_div('view-compose');
    // Clear out composition fields and reset field validation
    document.querySelectorAll(`[id*="form-"]`).forEach((item) => {
        item.value = '';
        item.className = 'form-control';
    })
}

/**
 * Retrieves an email and processes it per the process() function.
 * @param email_id
 * @param process function to process the email data.
 */
function process_email(email_id, process) {
    fetch(`/emails/${email_id}`)
        .then(response => {
            if (!response.ok) {
                throw Error(response.status + ' - ' + response.statusText);
            }
            return response.json();
        })
        .then(email => {
            return process(email);
        })
        .catch(error => {
            handle_error(error);
        })
}

function reply_email(email_id) {
    process_email(email_id, (email) => {
        const email_data = {sender: 'form-recipients', subject: 'form-subject', body: 'form-body'}
        for (const key in email_data) {
            if (key === 'subject')
                email[key] = (email.subject.startsWith('Re: ') ? email.subject : "Re: " + email.subject);
            if (key === 'body')
                email[key] = `\n===========\nOn ${email.timestamp} ${email.sender} wrote:`
                    + ` \n${email.body}`;
            document.querySelector(`#${email_data[key]}`).value = email[key];
        }
        document.querySelector('#compose-title').innerHTML = `<h3>Reply to Email</h3>`;
        show_view_div('view-compose');
    });
}

function read_email(email_id, hide_archive = false) {
    process_email(email_id, (email) => {
        // Loop through the email display fields and set the data
        const email_data = ['sender', 'recipients', 'timestamp', 'subject', 'body'];
        email_data.forEach((key) => {
            document.querySelector(`#${key}`).textContent = email[key];
        });
        // Load the reply and show/hide archive buttons.
        document.querySelectorAll(`[id*="read-"]`).forEach((item) => {
            item.dataset.email = email.id;
            if (item.id === 'read-archive') {
                if (hide_archive) {
                    item.style.display = 'none';
                } else {
                    // Toggle true/false button label based on current archived status.
                    item.textContent = (email.archived ? 'Un-Archive' : 'Archive');
                    item.dataset.archived = email.archived;
                    item.style.display = 'block';
                }
            }
        });
        // // If required, update the email to read.
        if (!email.read)
            put_email_flags(email.id, true, email.archived);
        show_view_div('view-read');
    })
}

function put_email_flags(email_id, read = true, archived = false, process_response) {
    // Call the api and toggle archived flags.
    fetch(`/emails/${email_id}`, {
        method: 'PUT',
        body: JSON.stringify({
            archived: archived,
            read: read
        })
    }).then(response => {
        if (!response.ok) {
            throw Error(response.status + ' - ' + response.statusText);
        }
        if (process_response) process_response();
        return true;
    }).catch(error => {
        handle_error(error);
    })
}

/**
 * Toggles the archived flag for the email id specified and loads the inbox.
 * @param email_id
 */
function toggle_archive_flag(email_id, archived) {
    // Call the api and toggle archived flags.
    put_email_flags(email_id, true, !(archived === 'true'), () => {
        load_mailbox('inbox');
    });
}

/** Validates the email form has all required data and calls
 * the Mail API to send email.
 *
 * @returns {boolean}
 */
function submit_form() {
    // Validate the email form fields, all are required.
    let form_valid = function () {
        // Loop through three form elements, if empty mark invalid and increment form_invalid_count.
        let form_invalid_count = 0;
        document.querySelectorAll(`[id*="form-"]`).forEach((item) => {
            item.className = (!item.value ? 'form-control is-invalid' : 'form-control is-valid');
            if (!item.value)
                form_invalid_count++; //set a flag based on result of validation
        })
        return (form_invalid_count === 0);
    }
    // All form fields have data.
    if (form_valid()) {
        fetch('/emails', {
            method: 'POST',
            body: JSON.stringify({
                recipients: document.querySelector('#form-recipients').value,
                subject: document.querySelector('#form-subject').value,
                body: document.querySelector('#form-body').value,
                read: false,
                archived: false
            })
        })
            .then(response => response.json())
            .then(result => {
                if (result.error) {
                    // API will validate recipients are registered and return an error if not.
                    document.querySelector('#recipients-alert').textContent = result.error;
                    document.querySelector('#form-recipients').className = 'form-control is-invalid';
                } else {
                    load_mailbox('sent');
                }
            }).catch(error => {
            handle_error(error);
        });
    }
    //Stop form from submitting.
    return false;
}

/**
 * Gets all emails in mailbox requested and
 * displays them in #view-emails.
 *
 * @param mailbox
 */
function load_mailbox(mailbox) {
    // Un-Read emails have a default (light) background but read emails have a dark one.
    const read_style = 'list-group-item-secondary';
    const default_style = 'list-group-item list-group-item-action ';

    fetch(`/emails/${mailbox}`)
        .then(response => {
            // Detect errors from the API.
            if (!response.ok) {
                throw Error(response.status + ' - ' + response.statusText);
            }
            return response.json();
        })
        .then(emails => {
            // Add title and content to #emails-view div for display
            const element = document.querySelector('#view-emails');
            element.innerHTML = `<h3>${mailbox.charAt(0).toUpperCase() + mailbox.slice(1)}</h3>`;
            // Show the mailbox and hide other views
            show_view_div('view-emails');
            // Handle a mailbox with no emails.
            if (emails.length === 0)
                return element.innerHTML += '<h3>No Emails Found.</h3>';
            // Create a new div with anchor for each email.
            let tester = emails.forEach(function (email) {
                const list_group_item = document.createElement('a');
                list_group_item.addEventListener('click', () => {
                    read_email(email.id, (mailbox === 'sent'));
                });
                list_group_item.className = default_style + (email.read ? read_style : '');
                list_group_item.innerHTML = `<strong>Sender:</strong> ${email.sender}<br/><b>Recipients:</b>`
                    + ` ${email.recipients}<br/><b>Subject:</b> ${email.subject}`
                    + `<br/><span class="small text-right">${email.timestamp}</span>`;
                list_group_item.href = '#'; // Gives an active link style to the element.
                element.append(list_group_item);
            })
        }).catch(error => {
        handle_error(error);
    });
}


/**
 * Displays the request view div and hides the remaining view divs.
 * @param view_div
 */
function show_view_div(view_div) {
    document.querySelectorAll(`[id*="view-"]`).forEach((item) => {
        item.style.display = (view_div === item.id ? 'block' : 'none');
    })
}

/**
 * Displays the error message to the user and logs to the console.
 * @param error
 */
function handle_error(error) {
    document.querySelector('#view-error').innerHTML = `<h1>A Problem Occurred.</h1><p>${error.message}</p>`;
    show_view_div('view-error');
    console.log(error);
}

// TODO: remove these functions if testing goes well.
// /**
//  * Retrieves all data associated with an email_id
//  * and displays in #view_read. Also, marks the email as read
//  * and stores requested email in localStorage to allow for
//  * archive/unarchive, if required.
//  *
//  * @param email_id
//  * @param hide_archive
//  */
// function read_email(email_id, hide_archive = false) {
//     fetch(`/emails/${email_id}`)
//         .then(response => {
//             if (!response.ok) {
//                 throw Error(response.status + ' - ' + response.statusText);
//             }
//             return response.json();
//         }).then(email => {
//         // Display email.
//
//         const email_data = ['sender', 'recipients', 'timestamp', 'subject', 'body'];
//         email_data.forEach((key) => {
//             document.querySelector(`#${key}`).textContent = email[key];
//         });
//
//         const reply_button = document.querySelector('#read-reply');
//         reply_button.dataset.email = email.id;
//
//         const archive_button = document.querySelector('#read-archive');
//         archive_button.dataset.email = email.id;
//         archive_button.dataset.archived = email.archived;
//         // Hide archive buttons for sent mail.
//         if (hide_archive) {
//             archive_button.style.display = 'none';
//         } else {
//             archive_button.style.display = 'block';
//             // Toggle true/false button label based on current archived status.
//             archive_button.textContent = (email.archived ? 'Un-Archive' : 'Archive');
//             // Add current email values to local storage, its used by toggle_archive_flag().
//             localStorage.setItem('active_email',
//                 JSON.stringify({
//                     email_id: email.id,
//                     archived: email.archived,
//                     read: true
//                 }));
//         }
//         show_view_div('view-read');
//         // If required, update the email to read.
//         if (!email.read)
//             fetch(`/emails/${email.id}`, {
//                 method: 'PUT',
//                 body: JSON.stringify({
//                     read: true
//                 })
//             }).then(response => {
//                 if (!response.ok) throw Error(response.status + ' - ' + response.statusText);
//             })
//     }).catch(error => {
//         handle_error(error);
//     });
// }

// /**
//  * Toggles the archived flag for the email id specified.
//  * @param email_id
//  */
// function toggle_archive_flag(email_id, archived) {
//     // Call the api and toggle archived flags.
//     fetch(`/emails/${email_id}`, {
//         method: 'PUT',
//         body: JSON.stringify({
//             archived: !(archived === 'true'),
//             read: true
//         })
//     }).then(response => {
//         if (!response.ok) {
//             throw Error(response.status + ' - ' + response.statusText);
//         }
//         load_mailbox('inbox');
//     }).catch(error => {
//         handle_error(error);
//     })
// }
// function reply_email(local_storage_key = "active_email") {
//     // Get the active email data.
//     const data = JSON.parse(localStorage.getItem(local_storage_key));
//
//     // Call the api and get email info.
//     fetch(`/emails/${data.email_id}`)
//         .then(response => {
//             if (!response.ok) {
//                 throw Error(response.status + ' - ' + response.statusText);
//             }
//             return response.json();
//         })
//         .then(email => {
//             const email_data = {
//                 sender: 'form-recipients',
//                 subject: 'form-subject',
//                 body: 'form-body'
//             }
//             for (const key in email_data) {
//                 if (key === 'subject')
//                     email[key] = (email.subject.startsWith('Re: ') ? email.subject : "Re: " + email.subject);
//                 if (key === 'body')
//                     email[key] = `\n===========\nOn ${email.timestamp} ${email.sender} wrote:`
//                         + ` \n${email.body}`;
//                 document.querySelector(`#${email_data[key]}`).value = email[key];
//             }
//             document.querySelector('#compose-title').innerHTML = `<h3>Reply to Email</h3>`;
//             show_view_div('view-compose');
//         })
//         .catch(error => {
//             handle_error(error);
//         })
// }