<?php

$adId = $_GET['id'] ?? '';
if (!preg_match('/^[a-fA-F0-9]{24}$/', $adId)) {
    http_response_code(404);
    exit('Not found');
}

$apiUrl = 'https://api.souqak-yem.com/api/ads/' . rawurlencode($adId);
$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => "Accept: application/json\r\n",
        'timeout' => 8,
        'ignore_errors' => true,
    ],
]);
$response = @file_get_contents($apiUrl, false, $context);
$ad = $response ? json_decode($response, true) : null;

if (!is_array($ad) || empty($ad['_id'])) {
    http_response_code(404);
    exit('Not found');
}

$siteUrl = 'https://souqak-yem.com';
$adUrl = $siteUrl . '/ad/' . rawurlencode($ad['_id']);
$title = trim((string)($ad['title'] ?? 'إعلان في سوقك'));
$description = trim(strip_tags((string)($ad['description'] ?? '')));
$description = mb_substr($description ?: ('شاهد هذا الإعلان على سوقك: ' . $title), 0, 160);
$image = is_array($ad['images'] ?? null) ? ($ad['images'][0] ?? '') : '';
$image = (string)$image;
if ($image && !preg_match('/^https?:\/\//i', $image)) {
    $image = 'https://api.souqak-yem.com/uploads/' . ltrim(preg_replace('#^/?uploads/#', '', $image), '/');
}
if (!$image) {
    $image = $siteUrl . '/logo.png';
}

$escape = static fn($value) => htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$safeTitle = $escape($title . ' | سوقك');
$safeDescription = $escape($description);
$safeUrl = $escape($adUrl);
$safeImage = $escape($image);
header('Content-Type: text/html; charset=UTF-8');
?>
<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta property="og:type" content="product">
  <meta property="og:url" content="<?= $safeUrl ?>">
  <meta property="og:title" content="<?= $safeTitle ?>">
  <meta property="og:description" content="<?= $safeDescription ?>">
  <meta property="og:image" content="<?= $safeImage ?>">
  <meta property="og:image:alt" content="<?= $safeTitle ?>">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="<?= $safeImage ?>">
  <meta http-equiv="refresh" content="0;url=<?= $safeUrl ?>">
  <title><?= $safeTitle ?></title>
</head>
<body>
  <a href="<?= $safeUrl ?>">فتح الإعلان</a>
</body>
</html>
