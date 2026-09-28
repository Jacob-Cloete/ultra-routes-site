<?php
// Hostinger SSH: php tools/manage-interest.php list [trip-id]
// confirm <id>, waitlist <id>, delete <id>. No public administration endpoint.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$_SERVER['DOCUMENT_ROOT']=getenv('FAST_DOCUMENT_ROOT') ?: dirname(__DIR__);
require dirname(__DIR__).'/api/storage.php';
$db=fast_db();$action=$argv[1]??'list';$id=$argv[2]??'';
if ($action==='list') {
    $query=$id ? $db->prepare('SELECT id,trip,name,email,status,created_at FROM interests WHERE trip=? ORDER BY created_at') : $db->prepare('SELECT id,trip,name,email,status,created_at FROM interests ORDER BY trip,created_at');
    $query->execute($id?[$id]:[]);fputcsv(STDOUT,['id','trip','name','email','status','created_at']);
    foreach($query as $row){$row['created_at']=gmdate('c',(int)$row['created_at']);foreach($row as &$value){if(is_string($value)&&preg_match('/^[=+\-@\t\r]/',$value))$value="'".$value;}unset($value);fputcsv(STDOUT,array_values($row));}exit;
}
if (!ctype_digit($id)||!in_array($action,['confirm','waitlist','delete'],true)) {fwrite(STDERR,"Usage: list [trip-id] | confirm <id> | waitlist <id> | delete <id>\n");exit(1);}
$db->exec('BEGIN IMMEDIATE');
$s=$db->prepare('SELECT * FROM interests WHERE id=?');$s->execute([$id]);$row=$s->fetch();
if(!$row){$db->exec('ROLLBACK');fwrite(STDERR,"Signup not found.\n");exit(1);}
if($action==='confirm' && $row['status']!=='confirmed'){
    $s=$db->prepare('SELECT COUNT(*) FROM interests WHERE trip=? AND status="confirmed"');$s->execute([$row['trip']]);
    if((int)$s->fetchColumn()>=4){$db->exec('ROLLBACK');fwrite(STDERR,"Four guests are already confirmed. No change made.\n");exit(1);}
}
if($action==='delete')$db->prepare('DELETE FROM interests WHERE id=?')->execute([$id]);
else $db->prepare('UPDATE interests SET status=? WHERE id=?')->execute([$action==='confirm'?'confirmed':'waitlist',$id]);
$db->exec('COMMIT');echo "Updated signup $id. No email was sent.\n";
