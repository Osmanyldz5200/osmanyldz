@echo off
title OsmanYLDZ - Is Asistani
echo =====================================================
echo      OsmanYLDZ Is Asistani Baslatiliyor...
echo =====================================================
echo.
echo Tarayici otomatik acilacak...
echo Kapatmak icin bu pencereyi kapatin veya Ctrl+C.
echo.
python -m http.server 8080
if %ERRORLEVEL% neq 0 (
    echo.
    echo Python bulunamadi. py komutu deneniyor...
    py -m http.server 8080
)
pause
