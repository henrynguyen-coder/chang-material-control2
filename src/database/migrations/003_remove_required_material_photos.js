export const version = 3;
export const name = 'remove-required-material-photos';

export async function up(db) {
  await db.executeSql('UPDATE materials SET photo_required = 0 WHERE photo_required <> 0');
  await db.executeSql(`
    UPDATE checklist_items
    SET requirement_text = trim(regexp_replace(requirement_text, ',[[:space:]]*chụp ảnh[^,]*', '', 'gi'))
    WHERE requirement_text ILIKE '%chụp ảnh%'
  `);
}
