<?php
declare(strict_types=1);
function fast_dir(): string {
    // On Hostinger this resolves outside public_html, even for subdirectories/subdomains.
    $root=realpath($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__));
    if (!$root) throw new RuntimeException('Missing document root');
    $configured=getenv('FAST_PRIVATE_DIR');
    $parent=dirname($root);
    // A subdomain may itself be inside the main domain's public_html.
    for($path=$root; $path!==dirname($path); $path=dirname($path)) {
        if(in_array(basename($path),['public_html','www','htdocs'],true)) $parent=dirname($path);
    }
    $dir=$configured?:$parent.'/fast-private';
    if (!is_dir($dir) && !mkdir($dir,0700,true) && !is_dir($dir)) throw new RuntimeException('Storage unavailable');
    $real=realpath($dir);
    if (!$real || $real===$root || strpos($real,$root.DIRECTORY_SEPARATOR)===0 || strpos($real,realpath(dirname(__DIR__)).DIRECTORY_SEPARATOR)===0 || preg_match('~/(public_html|htdocs|www)(/|$)~',$real)) throw new RuntimeException('Storage must be outside the website');
    chmod($real,0700);return $real;
}
function fast_db(): PDO {
    umask(0077);
    $db=new PDO('sqlite:'.fast_dir().'/interests.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA busy_timeout=5000');
    $db->exec('CREATE TABLE IF NOT EXISTS interests(id INTEGER PRIMARY KEY,trip TEXT NOT NULL,name TEXT NOT NULL,email TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,consent_version TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT "interested",UNIQUE(trip,email))');
    $db->exec('CREATE TABLE IF NOT EXISTS requests(ip_hash TEXT NOT NULL,at INTEGER NOT NULL)');
    return $db;
}
function fast_salt(): string {
    $path=fast_dir().'/rate-limit.key';
    $handle=fopen($path,'c+');if(!$handle)throw new RuntimeException('Key unavailable');
    flock($handle,LOCK_EX);$salt=stream_get_contents($handle);
    if (!$salt) {$salt=bin2hex(random_bytes(32));rewind($handle);fwrite($handle,$salt);fflush($handle);}
    flock($handle,LOCK_UN);fclose($handle);return $salt;
}
