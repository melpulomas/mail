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
 * Resets and displays the create email form.
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
                list_group_item.className = default_style + (email.read ? read_style : '');
                list_group_item.href = '#'; // Adding this so the user gets expected link mouse behaviour.
                list_group_item.innerHTML = `<strong>${email.sender}</strong><br/>${email.subject}`
                    + `<br/><span class="small text-right">${email.timestamp}</span>`;
                list_group_item.addEventListener('click', () => {
                    read_email(email.id);
                })
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
 * archive/unarchive.
 *
 * @param email_id
 */
function read_email(email_id) {
    fetch(`/emails/${email_id}`)
        .then(response => {
            // Detect errors from the API.
            if (!response.ok) {
                throw Error(response.status + ' - ' + response.statusText);
            }
            return response.json();
        }).then(email => {
        // Display email.
        document.querySelector('#read-from').textContent = email.sender;
        document.querySelector('#read-recipients').textContent = email.recipients;
        document.querySelector('#read-timestamp').textContent = email.timestamp;
        document.querySelector('#read-subject').textContent = email.subject;
        document.querySelector('#read-body').textContent = email.body;
        // Toggle true/false for archiving based on current archived status.
        document.querySelector('#read-archive').textContent = (email.archived ? 'Un-Archive' : 'Archive');
        show_view_div('view-read');
        // Add current email values to local storage to allow archive toggle.
        localStorage.setItem('active_email', JSON.stringify({
            email_id: email.id,
            archived: email.archived,
            read: true
        }));
        // If required, update the email to read, leave archived flag unchanged.
        if (!email.read)
            update_email_flags(email.id, true, email.archived);
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
function toggle_archive_flag(local_storage_key = "active_email",) {
    // Get the active email data and update flags.
    const data = JSON.parse(localStorage.getItem(local_storage_key));
    update_email_flags(data.email_id, true, !data.archived);
    load_mailbox('inbox');
}

/**
 * Updates the archived and read flags on the requested email and
 * displays the inbox. This method will default 'read' to true and
 * 'archived' to false.
 *
 * @param email_id
 * @param read
 * @param archived
 */
function update_email_flags(email_id, read = true, archived = false) {
    // Call the api with flags provided.
    fetch(`/emails/${email_id}`, {
        method: 'PUT',
        body: JSON.stringify({
            archived: archived,
            read: read
        })
        // TODO: error handling
    }).then(response => {
        if (!response.ok) {
            throw Error(response.statusText)
        }
    }).catch(error => {
        console.log(error);
    })
}

/**
 * Displays the request div and hides the remaining divs.
 * @param view_div
 */
function show_view_div(view_div) {
    document.querySelectorAll(`[id*="view-"]`).forEach((item) => {
        item.style.display = (view_div === item.id ? 'block' : 'none');
    })
}

/** Validates the email form has all required data and calls
 * the Mail API to send users email.
 *
 * @returns {boolean}
 */
function submit_form() {
    // Validate the email form fields, all are required.
    // TODO: should all fields be required?
    let form_valid = document.querySelector('#form-compose-recipients').value != '';
    document.querySelectorAll(`[id*="form-compose"]`).forEach((item) => {
        if (!item.value) {
            form_valid = false;
            item.className = 'form-control is-invalid';
        } else {
            item.className = 'form-control is-valid';
        }
    })
    // All form fields have data.
    if (form_valid) {
        fetch('/emails', {
            method: 'POST',
            body: JSON.stringify({
                recipients: document.querySelector('#form-compose-recipients').value,
                subject: document.querySelector('#form-compose-subject').value,
                body: document.querySelector('#form-compose-body').value.value,
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
