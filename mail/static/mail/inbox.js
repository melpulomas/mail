document.addEventListener('DOMContentLoaded', function () {
    // Use buttons to toggle between views
    document.querySelector('#inbox').addEventListener('click', () => load_mailbox('inbox'));
    document.querySelector('#sent').addEventListener('click', () => load_mailbox('sent'));
    document.querySelector('#archived').addEventListener('click', () => load_mailbox('archive'));
    document.querySelector('#compose').addEventListener('click', compose_email);
    document.querySelector('#read-archive').addEventListener('click', function () {
        toggle_archive_flag(this.dataset.email, this.dataset.archived);
    });
    document.querySelector('#read-reply').addEventListener('click', function () {
        reply_email(this.dataset.email);
    });
    document.querySelector('#compose-form').onsubmit = submit_form;
    // By default, load the inbox
    load_mailbox('inbox');
});

/**
 * Gets all email for mailbox requested and
 * displays them in #view-emails div.
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
            // Add title and content to #emails-view div for display.
            const element = document.querySelector('#view-emails');
            element.innerHTML = `<h3>${mailbox.charAt(0).toUpperCase() + mailbox.slice(1)}</h3>`;
            // Show the mailbox and hide other views.
            show_view_div('view-emails');
            // Handle a mailbox with no emails.
            if (emails.length === 0)
                return element.innerHTML += '<h3>No Emails Found.</h3>';
            // Create a new anchor element for each email.
            emails.forEach(function (email) {
                const list_group_item = document.createElement('a');
                list_group_item.addEventListener('click', () => {
                    read_email(email.id, (mailbox === 'sent'));
                });
                list_group_item.className = default_style + (email.read ? read_style : '');
                list_group_item.href = '#'; // Gives an active link style to the element.
                // Inbox does not display Recipient and Sent mail does not display Sender.
                let content = (mailbox !== 'sent' ? `<b>From:</b> ${email.sender} <br/>` : '');
                content += (mailbox !== 'inbox' ? `<b>To:</b> ${email.recipients} <br/>` : '');
                content += `<b>Subject:</b>` + (email.subject ? email.subject : ` (No Subject)`) + `<br/>`;
                content += `<span class="badge badge-info badge-pill">${email.timestamp}</span>`;
                list_group_item.innerHTML = content;
                element.append(list_group_item);
            })
        }).catch(error => {
        handle_error(error);
    });
}

/**
 * Resets and displays the compose email form.
 */
function compose_email() {
    // Show compose view and hide other views.
    show_view_div('view-compose');
    // Clear out composition fields and reset field validation.
    document.querySelectorAll(`[id*="form-"]`).forEach((item) => {
        item.value = '';
        item.className = 'form-control';
    })
}

/**
 * Toggles the archived flag for the email id specified and loads the inbox if successful.
 *
 * @param email_id
 */
function toggle_archive_flag(email_id, archived) {
    // Call the api and toggle archived flags.
    update_email_flags(email_id, true, !(archived === 'true'), () => {
        load_mailbox('inbox');
    });
}

/**
 * Retrieves an email, formats and pre-populate email data into the compose email form.
 *
 * @param email_id
 */
function reply_email(email_id) {
    get_email(email_id, (email) => {
        // Create an email data field & form field mapping.
        const email_data = {sender: 'form-recipients', subject: 'form-subject', body: 'form-body'}
        // Loop and process the data where required or simply reset the form field.
        for (const key in email_data) {
            if (key === 'subject')
                email[key] = (email.subject.startsWith('Re: ') ? email.subject : "Re: " + email.subject);
            if (key === 'body')
                email[key] = `\n===========\nOn ${email.timestamp} ${email.sender} wrote:`
                    + ` \n${email.body}`;
            const form_field = document.querySelector(`#${email_data[key]}`);
            form_field.value = email[key];
            // Reset any errors on the form that might exist from previous use.
            form_field.className = 'form-control';
        }
        document.querySelector('#compose-title').innerHTML = `<h3>Reply to Email</h3>`;
        show_view_div('view-compose');
    });
}

/**
 * Retrieves an email and processes it per the callback function provided.
 *
 * @param email_id
 * @param process_response function to process the email response.
 */
function get_email(email_id, process_response) {
    fetch(`/emails/${email_id}`)
        .then(response => {
            if (!response.ok) {
                throw Error(response.status + ' - ' + response.statusText);
            }
            return response.json();
        })
        .then(email => {
            return process_response(email);
        })
        .catch(error => {
            handle_error(error);
        })
}

/**
 * Retrieve an email and display the contents in #view-read. Also, sets a dataset attribute
 * of Archive and Reply buttons and hides the archive button if requested.
 *
 * @param email_id
 * @param hide_archive
 */
function read_email(email_id, hide_archive = false) {
    get_email(email_id, (email) => {
        // Loop through the email display fields and set the data.
        const email_data = ['sender', 'recipients', 'timestamp', 'subject', 'body'];
        email_data.forEach((key) => {
            document.querySelector(`#${key}`).innerText =
                (email[key] ? email[key] : `(No ` + key.charAt(0).toUpperCase() + key.slice(1) + ')');
        });
        // Load dataset for reply & archive buttons. Show/hide archive button and set its label.
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
        // If required, update the email to read.
        if (!email.read)
            update_email_flags(email.id, true, email.archived);
        show_view_div('view-read');
    })
}

/**
 * Creates a PUT request to update email archive and/or read flags. Also,
 * processes the data returned with callback function provided.
 *
 * @param email_id
 * @param read
 * @param archived
 * @param process_response
 */
function update_email_flags(email_id, read = true, archived = false, process_response) {
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
 * Validates the email form for recipients and calls
 * the Mail API to send email. Loads sent mailbox if successful.
 *
 * @returns {boolean}
 */
function submit_form() {
    const input_recipients = document.querySelector('#form-recipients');
    // Validate the form, recipients are required.
    let form_valid = function () {
        // If recipients field is empty, mark as invalid and return false.
        if (!input_recipients.value) {
            input_recipients.className = 'form-control is-invalid';
            return false;
        }
        input_recipients.className = 'form-control is-valid';
        return true;
    }
    // Form is valid, store the email data.
    if (form_valid()) {
        fetch('/emails', {
            method: 'POST',
            body: JSON.stringify({
                recipients: input_recipients.value,
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
 * Displays the requested view-*div and hides the remaining view-*divs.
 * @param view_div
 */
function show_view_div(view_div) {
    document.querySelectorAll(`[id*="view-"]`).forEach((item) => {
        item.style.display = (view_div === item.id ? 'block' : 'none');
    })
    // Reset focus to the top of the page.
    document.body.scrollTop;
}

/**
 * Displays error message to the user and logs it to the console.
 * @param error
 */
function handle_error(error) {
    document.querySelector('#view-error').innerHTML = `<h1>A Problem Occurred.</h1><p>${error.message}</p>`;
    show_view_div('view-error');
    console.log(error);
}