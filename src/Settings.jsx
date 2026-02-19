import {
  Button,
  Switch,
  Text,
  Field,
  Label,
  Divider,
  Card,
} from '@fluentui/react-components';
import {
  SettingsRegular,
  DarkThemeRegular,
  ColorRegular,
  ArrowDownloadRegular,
  ArrowUploadRegular,
  DeleteRegular,
  PaintBrushRegular,
  DatabaseRegular,
  InfoRegular,
  ChevronRightRegular,
  FolderAddRegular,
  FolderRegular,
  AddRegular,
  EditRegular,
} from '@fluentui/react-icons';
import { useState, useEffect } from 'react';
import { 
  exportSettingsToFile, 
  importSettingsFromFile, 
  clearAllSettings,
  getSetting,
  updateSetting
} from './utils/settingsManager';
import './Settings.css';

const Settings = ({ isDark, setIsDark, onNavigateToMetadata }) => {
  const [showPersonalizationDetails, setShowPersonalizationDetails] = useState(false);
  const [showDataManagementDetails, setShowDataManagementDetails] = useState(false);
  const [showAboutDetails, setShowAboutDetails] = useState(false);
  const [selectedColor, setSelectedColor] = useState(() => getSetting('accentColor', '#5c3d2e'));
  const [expandedCard, setExpandedCard] = useState(null); // לניהול כרטיס מורחב
  const [libraryFolders, setLibraryFolders] = useState(() => getSetting('libraryFolders', ['books']));
  const [backgroundMode, setBackgroundMode] = useState(() => getSetting('backgroundMode', 'with-image')); // 'with-image' או 'none'

  const colorOptions = [
    { name: 'חום קלאסי', value: '#5c3d2e' },
    { name: 'כחול', value: '#0078d4' },
    { name: 'ירוק', value: '#107c10' },
    { name: 'אדום', value: '#d13438' },
    { name: 'כתום', value: '#ff8c00' },
    { name: 'סגול', value: '#5c2d91' },
  ];

  const handleColorChange = (color) => {
    setSelectedColor(color.value);
    updateSetting('accentColor', color.value);
    
    // עדכון כל משתני הצבע הרלוונטיים
    const root = document.documentElement;
    root.style.setProperty('--colorBrandBackground', color.value);
    root.style.setProperty('--colorBrandBackgroundHover', color.value);
    root.style.setProperty('--colorBrandBackgroundPressed', color.value);
    root.style.setProperty('--colorBrandBackgroundSelected', color.value);
    root.style.setProperty('--colorBrandForeground1', color.value);
    root.style.setProperty('--colorBrandForeground2', color.value);
    root.style.setProperty('--colorBrandStroke1', color.value);
    root.style.setProperty('--colorBrandStroke2', color.value);
    
    // סגירת הכרטיס המורחב אחרי בחירה
    setExpandedCard(null);
  };

  const handleBackgroundModeChange = (mode) => {
    setBackgroundMode(mode);
    updateSetting('backgroundMode', mode);
    
    // עדכון הרקע בזמן אמת
    const root = document.documentElement;
    if (mode === 'none') {
      root.style.setProperty('--show-background-image', 'none');
      root.style.setProperty('--appBackgroundColor', '#ffffff');
      root.style.setProperty('--appBackgroundColorSecondary', '#f5f5f5');
      document.body.classList.remove('with-background');
    } else {
      root.style.setProperty('--show-background-image', 'block');
      root.style.setProperty('--appBackgroundColor', '#f7ead8');
      root.style.setProperty('--appBackgroundColorSecondary', '#f0e3d0');
      document.body.classList.add('with-background');
    }
    
    // סגירת הכרטיס המורחב אחרי בחירה
    setExpandedCard(null);
  };

  const handleAddFolder = async () => {
    try {
      const isTauri = window.__TAURI__ !== undefined;
      const isElectron = window.electron !== undefined;
      
      console.log('🔧 Environment check:', { isTauri, isElectron });
      
      if (isTauri) {
        // שימוש ב-Tauri dialog לבחירת תיקייה
        const { open } = await import('@tauri-apps/api/dialog');
        
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'בחר תיקיית ספרים'
        });

        const selectedPath = Array.isArray(selected) ? selected[0] : selected;
        
        if (selectedPath) {
          const folderName = selectedPath.split(/[/\\]/).pop();

          if (!libraryFolders.includes(selectedPath)) {
            const updatedFolders = [...libraryFolders, selectedPath];
            setLibraryFolders(updatedFolders);
            updateSetting('libraryFolders', updatedFolders);
            
            // הצג הודעה ורענן את האפליקציה
            if (window.confirm(`התיקייה "${folderName}" נוספה בהצלחה!\n\nנתיב: ${selectedPath}\n\nהאפליקציה תתרענן כעת כדי לטעון את הספרים החדשים.\n\nלחץ OK להמשך.`)) {
              window.location.reload();
            }
          } else {
            alert(`התיקייה "${folderName}" כבר קיימת בספרייה.`);
          }
        }
      } else if (isElectron) {
        // Electron - השתמש ב-IPC
        console.log('📁 Opening folder dialog in Electron...');
        const result = await window.electron.selectFolder();
        console.log('📁 Dialog result:', result);
        
        if (result.success && result.path) {
          const selectedPath = result.path;
          const folderName = selectedPath.split(/[/\\]/).pop();
          
          console.log('📁 Selected path:', selectedPath);
          console.log('📁 Folder name:', folderName);
          
          if (!libraryFolders.includes(selectedPath)) {
            const updatedFolders = [...libraryFolders, selectedPath];
            setLibraryFolders(updatedFolders);
            updateSetting('libraryFolders', updatedFolders);
            console.log('✅ Folder added:', updatedFolders);
            
            // הצג הודעה ורענן את האפליקציה
            if (window.confirm(`התיקייה "${folderName}" נוספה בהצלחה!\n\nנתיב: ${selectedPath}\n\nהאפליקציה תתרענן כעת כדי לטעון את הספרים החדשים.\n\nלחץ OK להמשך.`)) {
              window.location.reload();
            }
          } else {
            alert(`התיקייה "${folderName}" כבר קיימת בספרייה.`);
          }
        } else {
          console.log('❌ Dialog canceled or failed');
        }
      } else {
        // בדפדפן - יצירת input file עם webkitdirectory לבחירת תיקייה
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.multiple = true;
        
        input.onchange = (e) => {
          const files = Array.from(e.target.files);
          if (files.length > 0) {
            // קבלת שם התיקייה הראשית
            const folderPath = files[0].webkitRelativePath.split('/')[0];
            
            if (!libraryFolders.includes(folderPath)) {
              const updatedFolders = [...libraryFolders, folderPath];
              setLibraryFolders(updatedFolders);
              updateSetting('libraryFolders', updatedFolders);
              
              // הצג הודעה ורענן את האפליקציה
              if (window.confirm(`התיקייה "${folderPath}" נוספה בהצלחה!\n\nהאפליקציה תתרענן כעת כדי לטעון את הספרים החדשים.\n\nלחץ OK להמשך.`)) {
                window.location.reload();
              }
            } else {
              alert(`התיקייה "${folderPath}" כבר קיימת בספרייה.`);
            }
          }
        };
        
        input.click();
      }
    } catch (error) {
      console.error('שגיאה בהוספת תיקייה:', error);
      alert('שגיאה בהוספת התיקייה: ' + error.message);
    }
  };

  const handleRemoveFolder = (folderName) => {
    if (folderName === 'books') {
      alert('לא ניתן להסיר את תיקיית books הראשית');
      return;
    }
    
    if (confirm(`האם אתה בטוח שברצונך להסיר את התיקייה "${folderName}" מהספרייה?\n\nהאפליקציה תתרענן אחרי ההסרה.`)) {
      const updatedFolders = libraryFolders.filter(folder => folder !== folderName);
      setLibraryFolders(updatedFolders);
      updateSetting('libraryFolders', updatedFolders);
      
      // רענן את האפליקציה
      alert(`התיקייה "${folderName}" הוסרה מהספרייה`);
      window.location.reload();
    }
  };

  // טעינת הצבע והרקע השמורים בהתחלה - רק פעם אחת
  useEffect(() => {
    const savedColor = getSetting('accentColor', '#5c3d2e');
    const savedBackgroundMode = getSetting('backgroundMode', 'with-image');
    
    // עדכון ה-state רק אם שונה מהערך הנוכחי
    if (savedColor !== selectedColor) {
      setSelectedColor(savedColor);
    }
    if (savedBackgroundMode !== backgroundMode) {
      setBackgroundMode(savedBackgroundMode);
    }
    
    // עדכון משתני CSS רק בטעינה הראשונה
    const root = document.documentElement;
    root.style.setProperty('--colorBrandBackground', savedColor);
    root.style.setProperty('--colorBrandBackgroundHover', savedColor);
    root.style.setProperty('--colorBrandBackgroundPressed', savedColor);
    root.style.setProperty('--colorBrandBackgroundSelected', savedColor);
    root.style.setProperty('--colorBrandForeground1', savedColor);
    root.style.setProperty('--colorBrandForeground2', savedColor);
    root.style.setProperty('--colorBrandStroke1', savedColor);
    root.style.setProperty('--colorBrandStroke2', savedColor);

    // עדכון הרקע רק בטעינה הראשונה
    if (savedBackgroundMode === 'none') {
      root.style.setProperty('--show-background-image', 'none');
      root.style.setProperty('--appBackgroundColor', '#ffffff');
      root.style.setProperty('--appBackgroundColorSecondary', '#f5f5f5');
      document.body.classList.remove('with-background');
    } else {
      root.style.setProperty('--show-background-image', 'block');
      root.style.setProperty('--appBackgroundColor', '#f7ead8');
      root.style.setProperty('--appBackgroundColorSecondary', '#f0e3d0');
      document.body.classList.add('with-background');
    }
  }, []); // רץ רק פעם אחת בטעינה הראשונה

  const handleExportSettings = async () => {
    const success = await exportSettingsToFile();
    if (success) {
      alert('ההגדרות יוצאו בהצלחה לקובץ JSON');
    } else {
      alert('שגיאה בייצוא ההגדרות');
    }
  };

  const handleImportSettings = async () => {
    try {
      const settings = await importSettingsFromFile();
      
      // עדכון הממשק
      if (settings.theme) {
        setIsDark(settings.theme === 'dark');
      }
      
      alert('ההגדרות יובאו בהצלחה! רענן את הדף כדי לראות את השינויים.');
    } catch (error) {
      alert('שגיאה בייבוא ההגדרות: ' + error.message);
    }
  };

  const handleClearSettings = () => {
    if (confirm('האם אתה בטוח שברצונך למחוק את כל ההגדרות?')) {
      const success = clearAllSettings();
      if (success) {
        alert('כל ההגדרות נמחקו בהצלחה! רענן את הדף.');
      } else {
        alert('שגיאה במחיקת ההגדרות');
      }
    }
  };

  const handleUploadIndex = async () => {
    if (!confirm('האם אתה בטוח שברצונך להעלות את האינדקס? פעולה זו תמחק את האינדקס הקיים ותיצור אחד חדש.')) {
      return;
    }

    try {
      const isElectron = window.electron !== undefined;
      
      if (isElectron) {
        // הרצת הסקריפט דרך Electron
        alert('מתחיל העלאת אינדקס... התהליך עשוי לקחת מספר דקות. תקבל הודעה כשהתהליך יסתיים.');
        
        const result = await window.electron.runScript('upload-to-meili.js');
        
        if (result.success) {
          alert('האינדקס הועלה בהצלחה! החיפוש מוכן לשימוש.');
        } else {
          alert('שגיאה בהעלאת האינדקס: ' + result.error);
        }
      } else {
        alert('פעולה זו זמינה רק בגרסת Electron/Tauri של האפליקציה.\n\nכדי להריץ את הסקריפט ידנית, פתח טרמינל והרץ:\nnode scripts/upload-to-meili.js');
      }
    } catch (error) {
      console.error('שגיאה בהרצת סקריפט העלאת אינדקס:', error);
      alert('שגיאה בהרצת הסקריפט: ' + error.message);
    }
  };

  if (showAboutDetails) {
    return (
      <div className="settings-page-win11">
        <div className="settings-container-win11">
          {/* כותרת עם נתיב ניווט */}
          <div className="settings-header-win11">
            <div className="breadcrumb-navigation">
              <Button
                appearance="subtle"
                onClick={() => setShowAboutDetails(false)}
                className="breadcrumb-button"
              >
                הגדרות
              </Button>
              <ChevronRightRegular className="breadcrumb-separator" />
              <Text size={900} weight="semibold" className="current-page-title">אודות האויצר</Text>
            </div>
          </div>

          {/* תוכן דף האודות */}
          <div className="settings-grid-win11">
            
            {/* כרטיס מידע על האפליקציה */}
            <div className="settings-card-win11 about-app-card">
              <div className="card-content-win11" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '20px', padding: '40px 20px' }}>
                <div className="app-logo">
                  <Text size={1000} weight="bold" style={{ 
                    fontFamily: 'DrugulinCLM-Bold, Arial, sans-serif',
                    background: 'linear-gradient(135deg, #2c1810 0%, #5c3d2e 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    האויצר
                  </Text>
                </div>
                <Text size={300} style={{ textAlign: 'center', opacity: 0.8 }}>
                  מאגר ספרים תורני מתקדם
                </Text>
                <Text size={600} weight="semibold" style={{ color: '#5c3d2e' }}>
                  גרסה 1.0.0
                </Text>
              </div>
            </div>

            {/* כרטיס תרומות */}
            <div className="settings-card-win11">
              <div className="card-content-win11" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px', padding: '20px' }}>
                <Text size={400} weight="semibold">תרומות</Text>
                <Text size={300} style={{ textAlign: 'center', opacity: 0.7 }}>
                תמכו בנו! כדי שנוכל להמשיך ולהוביל את האויצר לכל לומד ולשפר את מהירות ונראות התוכנה
                </Text>
                <Text size={300} style={{ textAlign: 'center', opacity: 0.7 }}>
                  יש לכם ספר שלא נמצא באויצר פנו אלינו ונוסיף אותו בהקדם !
                </Text>
              </div>
            </div>

            {/* כרטיס מפתחים */}
            <div className="settings-card-win11">
              <div className="card-content-win11" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px', padding: '20px' }}>
                <Text size={400} weight="semibold">מפתחים</Text>
                <Text size={300} style={{ textAlign: 'center', opacity: 0.7 }}>
                יוצר התוכנה:@userbot 
                </Text>
                <Text size={300} style={{ textAlign: 'center', opacity: 0.7 }}>
                  פרוייקט האויצר הוא פרויקט בקוד פתוח ומפתחים מוזמנים להצטרף לקהילת הפיתוח בגיטהאב
                </Text>
              </div>
            </div>

            {/* כרטיס תודות */}
            <div className="settings-card-win11">
              <div className="card-content-win11" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <Text size={400} weight="semibold">תודות</Text>
                </div>
                <div className="thanks-list">
                  <Text size={300} style={{ opacity: 0.8 }}>
                    • לפרוייקט אוצריא על ספריית הטקסטים
                  </Text>
                  <Text size={300} style={{ opacity: 0.8 }}>
                    • לאתר hebrow books על מאגר הספרים בפורמט pdf
                  </Text>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  if (showDataManagementDetails) {
    return (
      <div className="settings-page-win11">
        <div className="settings-container-win11">
          {/* כותרת עם נתיב ניווט */}
          <div className="settings-header-win11">
            <div className="breadcrumb-navigation">
              <Button
                appearance="subtle"
                onClick={() => setShowDataManagementDetails(false)}
                className="breadcrumb-button"
              >
                הגדרות
              </Button>
              <ChevronRightRegular className="breadcrumb-separator" />
              <Text size={900} weight="semibold" className="current-page-title">ניהול נתונים</Text>
            </div>
          </div>

          {/* הגדרות ניהול נתונים מפורטות */}
          <div className="settings-grid-win11">
            
            {/* כרטיס ניהול תיקיות ספרייה */}
            <div className="settings-card-win11 library-folders-card">
              <div className="card-content-win11" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <FolderRegular className="card-icon-win11" />
                  <Text size={400} weight="semibold">תיקיות ספרייה</Text>
                </div>
                <Text size={300} style={{ opacity: 0.7 }}>
                  נהל את התיקיות שמכילות את הספרים שלך. השתמש בנתיבים מלאים (לדוגמה: C:\Users\YourName\Documents\Books)
                </Text>
                
                <div className="folders-list" style={{ width: '100%' }}>
                  {libraryFolders.map((folder) => (
                    <div key={folder} className="folder-item">
                      <FolderRegular className="folder-icon" />
                      <Text size={300} className="folder-name">{folder}</Text>
                      {folder !== 'books' && (
                        <Button
                          appearance="subtle"
                          icon={<DeleteRegular />}
                          onClick={() => handleRemoveFolder(folder)}
                          className="remove-folder-btn"
                          size="small"
                        />
                      )}
                    </div>
                  ))}
                </div>
                
                <Button
                  appearance="secondary"
                  icon={<FolderAddRegular />}
                  onClick={handleAddFolder}
                  className="add-folder-btn"
                  style={{ width: '100%' }}
                >
                  הוסף תיקייה
                </Button>
              </div>
            </div>

            {/* כרטיס גיבוי והחזרת הגדרות */}
            <div className="settings-card-win11">
              <div className="card-content-win11" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <ArrowDownloadRegular className="card-icon-win11" />
                  <Text size={400} weight="semibold">גיבוי והחזרת הגדרות</Text>
                </div>
                <Text size={300} style={{ opacity: 0.7 }}>
                  ייצא את כל ההגדרות שלך לקובץ JSON או ייבא הגדרות מקובץ קיים
                </Text>
                <div className="backup-buttons" style={{ width: '100%' }}>
                  <Button
                    appearance="secondary"
                    icon={<ArrowDownloadRegular />}
                    onClick={handleExportSettings}
                  >
                    ייצא הגדרות
                  </Button>
                  <Button
                    appearance="secondary"
                    icon={<ArrowUploadRegular />}
                    onClick={handleImportSettings}
                  >
                    ייבא הגדרות
                  </Button>
                </div>
              </div>
            </div>

            {/* כרטיס עורך מטא-דאטה */}
            <div className="settings-card-win11">
              <div className="card-content-win11" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <EditRegular className="card-icon-win11" />
                  <Text size={400} weight="semibold">עורך מטא-דאטה</Text>
                </div>
                <Text size={300} style={{ opacity: 0.7 }}>
                  ערוך את המטא-דאטה של הספרים (כותרות, מחברים, קטגוריות ותוכן עניינים)
                </Text>
                <Button
                  appearance="primary"
                  icon={<EditRegular />}
                  onClick={onNavigateToMetadata}
                  style={{ width: '100%' }}
                >
                  פתח עורך מטא-דאטה
                </Button>
              </div>
            </div>

            {/* כרטיס העלאת אינדקס */}
            <div className="settings-card-win11">
              <div className="card-content-win11" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <ArrowUploadRegular className="card-icon-win11" />
                  <Text size={400} weight="semibold">העלאת אינדקס חיפוש</Text>
                </div>
                <Text size={300} style={{ opacity: 0.7 }}>
                  העלה את אינדקס החיפוש ל-Meilisearch. הסקריפט ימחק את האינדקס הקיים ויצור אחד חדש עם הגדרות חיפוש מתקדמות.
                </Text>
                <Button
                  appearance="primary"
                  icon={<ArrowUploadRegular />}
                  onClick={handleUploadIndex}
                  style={{ width: '100%' }}
                >
                  הרץ העלאת אינדקס
                </Button>
              </div>
            </div>

            {/* כרטיס מחיקת נתונים */}
            <div className="settings-card-win11">
              <div className="card-content-win11" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <DeleteRegular className="card-icon-win11" />
                  <Text size={400} weight="semibold">מחיקת נתונים</Text>
                </div>
                <Text size={300} style={{ opacity: 0.7 }}>
                  מחק את כל ההגדרות והכרטיסיות השמורות
                </Text>
                <Button
                  appearance="secondary"
                  icon={<DeleteRegular />}
                  onClick={handleClearSettings}
                  className="danger-button-expanded"
                  style={{ width: '100%' }}
                >
                  מחק את כל ההגדרות
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  if (showPersonalizationDetails) {
    return (
      <div className="settings-page-win11">
        <div className="settings-container-win11">
          {/* כותרת עם נתיב ניווט */}
          <div className="settings-header-win11">
            <div className="breadcrumb-navigation">
              <Button
                appearance="subtle"
                onClick={() => setShowPersonalizationDetails(false)}
                className="breadcrumb-button"
              >
                הגדרות
              </Button>
              <ChevronRightRegular className="breadcrumb-separator" />
              <Text size={900} weight="semibold" className="current-page-title">התאמה אישית</Text>
            </div>
          </div>

          {/* הגדרות התאמה אישית מפורטות */}
          <div className="settings-grid-win11">
            
            {/* כרטיס מצב תצוגה */}
            <div className="settings-card-win11">
              <div className="card-content-win11">
                <DarkThemeRegular className="card-icon-win11" />
                <div className="card-text-win11">
                  <Text size={400} weight="semibold">מצב תצוגה</Text>
                  <Text size={300} className="card-subtitle-win11">
                    {isDark ? 'מצב כהה פעיל' : 'מצב בהיר פעיל'}
                  </Text>
                </div>
                <Switch
                  checked={isDark}
                  onChange={(e, data) => setIsDark(data.checked)}
                  className="theme-switch-win11"
                />
              </div>
            </div>

            {/* כרטיס צבע בסיס מתרחב */}
            <div 
              className={`settings-card-win11 ${expandedCard === 'colors' ? 'expanded' : ''}`}
              onClick={() => setExpandedCard(expandedCard === 'colors' ? null : 'colors')}
            >
              <div className="card-content-win11">
                <ColorRegular className="card-icon-win11" />
                <div className="card-text-win11">
                  <Text size={400} weight="semibold">צבע בסיס</Text>
                  <Text size={300} className="card-subtitle-win11">
                    {colorOptions.find(c => c.value === selectedColor)?.name || 'מותאם אישית'}
                  </Text>
                </div>
                <div className="color-preview-win11">
                  <div className="color-dot-win11" style={{ backgroundColor: selectedColor }}></div>
                </div>
              </div>
              
              {/* תוכן מורחב */}
              {expandedCard === 'colors' && (
                <div className="expanded-content" onClick={(e) => e.stopPropagation()}>
                  <div className="color-options-expanded">
                    {colorOptions.map((color) => (
                      <div
                        key={color.value}
                        className={`color-option-expanded ${selectedColor === color.value ? 'selected' : ''}`}
                        style={{ backgroundColor: color.value }}
                        onClick={() => handleColorChange(color)}
                        title={color.name}
                      >
                        {selectedColor === color.value && (
                          <span className="color-check-expanded">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* כרטיס רקע מתרחב */}
            <div 
              className={`settings-card-win11 ${expandedCard === 'background' ? 'expanded' : ''}`}
              onClick={() => setExpandedCard(expandedCard === 'background' ? null : 'background')}
            >
              <div className="card-content-win11">
                <PaintBrushRegular className="card-icon-win11" />
                <div className="card-text-win11">
                  <Text size={400} weight="semibold">רקע</Text>
                  <Text size={300} className="card-subtitle-win11">
                    {backgroundMode === 'none' ? 'ללא רקע' : 'עם תמונת רקע'}
                  </Text>
                </div>
                <ChevronRightRegular className="card-arrow-win11" />
              </div>
              
              {/* תוכן מורחב */}
              {expandedCard === 'background' && (
                <div className="expanded-content" onClick={(e) => e.stopPropagation()}>
                  <div className="background-options-expanded">
                    <div
                      className={`background-option-expanded ${backgroundMode === 'none' ? 'selected' : ''}`}
                      onClick={() => handleBackgroundModeChange('none')}
                    >
                      <div className="background-preview none-preview">
                        <Text size={200}>ללא</Text>
                      </div>
                      <Text size={300} style={{ marginTop: '8px', textAlign: 'center' }}>
                        ללא רקע
                      </Text>
                    </div>
                    
                    <div
                      className={`background-option-expanded ${backgroundMode === 'with-image' ? 'selected' : ''}`}
                      onClick={() => handleBackgroundModeChange('with-image')}
                    >
                      <div className="background-preview image-preview">
                        <Text size={200}>רקע</Text>
                      </div>
                      <Text size={300} style={{ marginTop: '8px', textAlign: 'center' }}>
                        עם תמונת רקע
                      </Text>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page-win11">
      <div className="settings-container-win11">
        {/* כותרת הדף */}
        <div className="settings-header-win11">
          <Text size={900} weight="semibold" className="settings-title-win11">הגדרות</Text>
        </div>

        {/* רשת הכרטיסים בסגנון Windows 11 */}
        <div className="settings-grid-win11">
          
          {/* כרטיס התאמה אישית */}
          <div className="settings-card-win11 personalization-card" onClick={() => setShowPersonalizationDetails(true)}>
            <div className="card-content-win11">
              <PaintBrushRegular className="card-icon-win11" />
              <div className="card-text-win11">
                <Text size={400} weight="semibold">התאמה אישית</Text>
                <Text size={300} className="card-subtitle-win11">רקע, צבעים, מצב תצוגה</Text>
              </div>
              <ChevronRightRegular className="card-arrow-win11" />
            </div>
          </div>

          {/* כרטיס ניהול נתונים */}
          <div 
            className="settings-card-win11"
            onClick={() => setShowDataManagementDetails(true)}
          >
            <div className="card-content-win11">
              <DatabaseRegular className="card-icon-win11" />
              <div className="card-text-win11">
                <Text size={400} weight="semibold">ניהול נתונים</Text>
                <Text size={300} className="card-subtitle-win11">
                  ספרייה, גיבוי ושחזור הגדרות
                </Text>
              </div>
              <ChevronRightRegular className="card-arrow-win11" />
            </div>
          </div>

          {/* כרטיס אודות */}
          <div 
            className="settings-card-win11"
            onClick={() => setShowAboutDetails(true)}
          >
            <div className="card-content-win11">
              <InfoRegular className="card-icon-win11" />
              <div className="card-text-win11">
                <Text size={400} weight="semibold">אודות האויצר</Text>
                <Text size={300} className="card-subtitle-win11">מידע על האפליקציה וגרסה</Text>
              </div>
              <ChevronRightRegular className="card-arrow-win11" />
            </div>
          </div>

          {/* כרטיס ריק לעיצוב */}
          <div className="settings-card-win11 placeholder-card">
            <div className="card-content-win11">
              <SettingsRegular className="card-icon-win11" />
              <div className="card-text-win11">
                <Text size={400} weight="semibold">הגדרות נוספות</Text>
                <Text size={300} className="card-subtitle-win11">בקרוב...</Text>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Settings;