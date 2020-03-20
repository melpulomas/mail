document.addEventListener('DOMContentLoaded', function () {

    // Use buttons to toggle between views
    document.querySelector('#inbox').addEventListener('click', () => load_mailbox('inbox'));
    document.querySelector('#sent').addEventListener('click', () => load_mailbox('sent'));
    document.querySelector('#archived').addEventListener('click', () => load_mailbox('archive'));
    document.querySelector('#compose').addEventListener('click', compose_email);
    document.querySelector('#read-archive').addEventListener('click', () => {
        toggle_archive_flag('active_email');
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
    document.querySelectorAll(`[id*="form-compose"]`).forEach((item) => {
        item.value = '';
        item.className = 'form-control';
    })
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
            // Create a new div with anchor for each email.
            emails.forEach(function (email) {
                const list_group_item = document.createElement('a');
                list_group_item.addEventListener('click', () => {
                    read_email(email.id, (mailbox === 'sent'));
                });
                list_group_item.className = default_style + (email.read ? read_style : '');
                list_group_item.innerHTML = `<strong>${email.sender}</strong><br/>${email.subject}`
                    + `<br/><span class="small text-right">${email.timestamp}</span>`;
                list_group_item.href = '#'; // Gives an active link style to the element.
                element.append(list_group_item);
            })
            // Show the mailbox and hide other views
            show_view_div('view-emails')
        }).catch(error => {
        document.querySelector('#view-error').innerHTML = `<h1>A Problem Occurred.</h1><p>${error.message}</p>`;
        show_view_div('view-error');
        console.log(error);
    });
}

/**
 * Retrieves all data associated with an email_id
 * and displays in #view_read. Also, marks the email as read
 * and stores requested email in localStorage to allow for
 * archive/unarchive, if required.
 *
 * @param email_id
 * @param hide_archive
 */
function read_email(email_id, hide_archive = false) {
    fetch(`/emails/${email_id}`)
        .then(response => {
            if (!response.ok) {
                throw Error(response.status + ' - ' + response.statusText);
            }
            return response.json();
        }).then(email => {
        // Display email.
        const email_data = {
            sender: 'read-from',
            recipients: 'read-recipients',
            timestamp: 'read-timestamp',
            subject: 'read-subject',
            body: 'read-body'
        }
        for (const key in email_data) {
            document.querySelector(`#${email_data[key]}`).textContent = email[key];
        }
        // Hide archive buttons for sent mail.
        const archive_button = document.querySelector('#read-archive');
        if (hide_archive) {
            archive_button.style.display = 'none';
        } else {
            archive_button.style.display = 'block';
            // Toggle true/false button label based on current archived status.
            archive_button.textContent = (email.archived ? 'Un-Archive' : 'Archive');
            // Add current email values to local storage, its used by toggle_archive_flag().
            localStorage.setItem('active_email',
                JSON.stringify({
                    email_id: email.id,
                    archived: email.archived,
                    read: true
                }));
        }
        show_view_div('view-read');
        // If required, update the email to read.
        if (!email.read)
            fetch(`/emails/${email.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    read: true
                })
            }).then(response => {
                if (!response.ok) throw Error(response.status + ' - ' + response.statusText);
            })
    }).catch(error => {
        document.querySelector('#view-error').innerHTML = `<h1>A Problem Occurred.</h1><p>${error.message}</p>`;
        show_view_div('view-error');
        console.log(error);
    });
}

/**
 * Gets the active email from localStorage and toggles the archived flag.
 * @param local_storage_key
 */
function toggle_archive_flag(local_storage_key = "active_email") {
    // Get the active email data.
    const data = JSON.parse(localStorage.getItem(local_storage_key));
    // Call the api and toggle archived flags.
    fetch(`/emails/${data.email_id}`, {
        method: 'PUT',
        body: JSON.stringify({
            archived: !data.archived,
            read: true
        })
    }).then(response => {
        if (!response.ok) {
            throw Error(response.status + ' - ' + response.statusText);
        }
        load_mailbox('inbox');
    }).catch(error => {
        document.querySelector('#view-error').innerHTML = `<h1>A Problem Occurred.</h1><p>${error.message}</p>`;
        show_view_div('view-error');
        console.log(error);
    })
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
        document.querySelectorAll(`[id*="form-compose"]`).forEach((item) => {
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
                recipients: document.querySelector('#form-compose-recipients').value,
                subject: document.querySelector('#form-compose-subject').value,
                body: document.querySelector('#form-compose-body').value,
                read: false,
                archived: false
            })
        })
            .then(response => response.json())
            .then(result => {
                if (result.error) {
                    // API will validate recipients are registered and return an error if not.
                    document.querySelector('#compose-form-alert').textContent = result.error;
                    document.querySelector('#form-compose-recipients').className = 'form-control is-invalid';
                } else {
                    load_mailbox('sent');
                }
            }).catch(error => {
            document.querySelector('#view-error').innerHTML = `<h1>A Problem Occurred.</h1><p>${error.message}</p>`;
            show_view_div('view-error');
            console.log(error);
        });
    }
    //Stop form from submitting.
    return false;
}

