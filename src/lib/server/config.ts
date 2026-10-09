// Notes are personal: on locally, off in the Docker image (NOTES_ENABLED=false),
// which hides every notes feature and never touches the notes/ folder.
export const notesEnabled = process.env.NOTES_ENABLED !== 'false';
