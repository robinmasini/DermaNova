import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import * as pdfjsLib from 'pdfjs-dist';
import './Dashboard.css';
import logo from '../assets/dn.png';
import bgImage from '../assets/background.png';
import robotImg from '../assets/robot.png';

// Configuration du worker PDF.js via CDN pour éviter les problèmes de build Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default function Dashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [resultTab, setResultTab] = useState('diagnostic');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  
  // States persistants (chargement depuis localStorage)
  const [patients, setPatients] = useState(() => {
    const saved = localStorage.getItem('dermaNovaPatients');
    if (saved) return JSON.parse(saved);
    return [
      { id: 1, initial: 'J', name: 'Juliette R.', age: 19, date: "Aujourd'hui", status: 'En amélioration', statusClass: 'improving' }
    ];
  });
  
  const [pdfs, setPdfs] = useState(() => {
    const saved = localStorage.getItem('dermaNovaPdfs');
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('dermaNovaGeminiKey') || '');
  const [isKeySaved, setIsKeySaved] = useState(!!localStorage.getItem('dermaNovaGeminiKey'));

  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [newPatientData, setNewPatientData] = useState({ name: '', age: '' });

  const [isPdfUploading, setIsPdfUploading] = useState(false);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // Sauvegarde automatique lors des changements
  useEffect(() => {
    localStorage.setItem('dermaNovaPatients', JSON.stringify(patients));
  }, [patients]);

  useEffect(() => {
    localStorage.setItem('dermaNovaPdfs', JSON.stringify(pdfs));
  }, [pdfs]);

  const saveGeminiKey = () => {
    localStorage.setItem('dermaNovaGeminiKey', geminiKey);
    setIsKeySaved(true);
    alert("Clé Gemini sauvegardée avec succès ! L'IA est maintenant active.");
  };

  const handleImageUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage({
        url: URL.createObjectURL(file),
        name: file.name,
        size: file.size
      });
      setAnalysisResult(null);
    }
  };

  const extractTextFromPDF = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      // On lit au maximum les 10 premières pages pour ne pas saturer la mémoire locale du navigateur
      const numPages = Math.min(pdf.numPages, 10);
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map(item => item.str);
        fullText += strings.join(" ") + " ";
      }
      return fullText;
    } catch (e) {
      console.error("Erreur lors de la lecture du PDF", e);
      return "Erreur d'extraction du texte.";
    }
  };

  const handlePdfUpload = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsPdfUploading(true);
      
      const extractedText = await extractTextFromPDF(file);
      
      const newPdf = {
        id: Date.now(),
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
        type: "Document médical",
        status: "Intégré à 100%",
        date: "À l'instant",
        // On tronque à 50 000 caractères pour ne pas exploser le localStorage (environ 50ko)
        content: extractedText.substring(0, 50000) 
      };
      
      setPdfs([newPdf, ...pdfs]);
      setIsPdfUploading(false);
    }
  };

  const handleAddPatient = (e) => {
    e.preventDefault();
    if (!newPatientData.name) return;
    
    const newPatient = {
      id: Date.now(),
      initial: newPatientData.name.charAt(0).toUpperCase(),
      name: newPatientData.name,
      age: newPatientData.age || 0,
      date: "À l'instant",
      status: "Nouveau dossier",
      statusClass: "stable"
    };
    
    setPatients([newPatient, ...patients]);
    setIsNewPatientModalOpen(false);
    setNewPatientData({ name: '', age: '' });
  };

  const startAnalysis = async () => {
    if (!selectedImage) {
      alert("Veuillez d'abord importer une photo.");
      return;
    }
    if (!geminiKey) {
      alert("Veuillez configurer votre clé API Gemini dans l'onglet Paramètres pour lancer une vraie analyse IA.");
      return;
    }
    
    setAnalysisResult(null);
    setResultTab('diagnostic');
    setIsAnalyzing(true);
    
    try {
      // 1. Construire le contexte PDF
      let pdfContext = "";
      if (pdfs.length > 0) {
        pdfContext = "Voici des extraits des ouvrages médicaux de référence fournis par le praticien. BASE TES CONCLUSIONS SUR CES OUVRAGES :\n\n" + 
          pdfs.map(p => `--- OUVRAGE: ${p.name} ---\n${p.content.substring(0, 8000)}`).join("\n\n");
      }

      const prompt = `Tu es une Intelligence Artificielle médicale d'élite spécialisée en dermatologie, nommée DermaNova.
      Ton objectif est d'analyser rigoureusement l'image de peau fournie et de renvoyer un diagnostic précis au format JSON valide.
      
      ${pdfContext}
      
      IMPORTANT: Analyse l'image du patient objectivement. Si la littérature (fournie ci-dessus) mentionne des traitements ou diagnostics spécifiques pertinents pour les caractéristiques visibles sur l'image, intègre-les absolument.
      
      Renvoie STRICTEMENT un objet JSON avec la structure suivante (aucun autre texte, ni markdown):
      {
        "hydration": "Valeur en %",
        "ph": "Valeur",
        "elasticity": "Valeur en %",
        "aging": {
          "bioAge": "Âge estimé",
          "wrinkles": "Niveau (ex: Légères, Modérées)",
          "collagenLoss": "Valeur en %",
          "details": "Analyse détaillée en une phrase"
        },
        "diagnosis": "Diagnostic clinique hyper détaillé de 3 phrases, IMPÉRATIVEMENT justifié par l'image ET la littérature fournie.",
        "recommendation": "Prescription suggérée",
        "routine": {
          "matin": "Routine du matin détaillée",
          "soir": "Routine du soir détaillée"
        }
      }`;

      // 2. Initialiser Gemini
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      
      // 3. Préparer l'image en Base64
      const responseImg = await fetch(selectedImage.url);
      const blob = await responseImg.blob();
      const base64data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });

      // 4. Appel à l'API Gemini 2.5 Flash
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          prompt,
          { inlineData: { data: base64data, mimeType: blob.type } }
        ],
        config: {
          responseMimeType: "application/json",
        }
      });

      const resultText = response.text;
      const parsedJSON = JSON.parse(resultText);
      setAnalysisResult(parsedJSON);
      
    } catch (error) {
      alert("Erreur lors de l'analyse IA : " + error.message + "\n\nVérifiez que votre clé API est valide.");
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord' },
    { id: 'patients', label: 'Liste Patients' },
    { id: 'pdf_knowledge', label: 'Connaissances PDF' },
    { id: 'settings', label: 'Paramètres' },
  ];

  const renderScannerCard = () => (
    <div className="unified-scanner-card animate-fade-in">
      <div className="card-header">
        <h2>ANALYSE <span className="brand-light">DERMATOLOGIQUE</span></h2>
      </div>
      <p className="card-description">
        Importez ou prenez une photo directe. L'IA croisera les données visuelles avec vos documents PDF intégrés.
      </p>
      
      <div className="scanner-body">
        <div className="upload-column glass-panel">
          <div className="upload-container compact" onClick={() => fileInputRef.current.click()}>
            {selectedImage ? (
              <div className="uploaded-image-wrapper">
                <img src={selectedImage.url} alt="Scan preview" className="uploaded-image" />
                {isAnalyzing && <div className="scan-laser"></div>}
              </div>
            ) : (
              <div className="upload-placeholder">
                <div className="upload-icon-ring">
                  <span className="upload-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                  </span>
                </div>
                <h3>Photo</h3>
                <span className="upload-subtext">Caméra ou Galerie</span>
              </div>
            )}
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImageUpload} 
            />
          </div>
          {selectedImage && (
            <div className="upload-actions">
              <button className="change-photo-btn" onClick={() => fileInputRef.current.click()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', verticalAlign: 'middle'}}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                Changer
              </button>
              <button className="save-patient-btn" onClick={() => setIsNewPatientModalOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', verticalAlign: 'middle'}}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                Enregistrer
              </button>
            </div>
          )}
        </div>

        <div className="results-column glass-panel">
          {isAnalyzing ? (
            <div className="analyzing-state">
              <div className="spinner"></div>
              <p className="scanning-text">Analyse multimodale IA en cours...</p>
            </div>
          ) : analysisResult ? (
            <div className="analysis-results animate-fade-in">
              <div className="result-tabs">
                <button 
                  className={`result-tab ${resultTab === 'diagnostic' ? 'active' : ''}`}
                  onClick={() => setResultTab('diagnostic')}
                >
                  DIAGNOSTIC
                </button>
                <button 
                  className={`result-tab ${resultTab === 'traitement' ? 'active' : ''}`}
                  onClick={() => setResultTab('traitement')}
                >
                  TRAITEMENT
                </button>
              </div>

              {resultTab === 'diagnostic' && (
                <div className="tab-content animate-fade-in">
                  <h3 className="results-title">RÉSULTATS BIOMÉTRIQUES</h3>
                  <div className="metrics-grid">
                    <div className="metric-box">
                      <span className="metric-label">HYDRATATION</span>
                      <span className="metric-value">{analysisResult.hydration}</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">PH DERMIQUE</span>
                      <span className="metric-value">{analysisResult.ph}</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">ÉLASTICITÉ</span>
                      <span className="metric-value">{analysisResult.elasticity}</span>
                    </div>
                  </div>
                  
                  <div className="aging-analysis">
                    <h4>VIEILLISSEMENT CUTANÉ</h4>
                    <div className="aging-stats">
                      <div className="aging-stat"><span>Âge Biologique</span><strong>{analysisResult.aging.bioAge}</strong></div>
                      <div className="aging-stat"><span>Rides & Ridules</span><strong>{analysisResult.aging.wrinkles}</strong></div>
                      <div className="aging-stat"><span>Perte Collagène</span><strong>{analysisResult.aging.collagenLoss}</strong></div>
                    </div>
                    <p className="aging-details">{analysisResult.aging.details}</p>
                  </div>

                  <div className="ai-diagnosis">
                    <h4>DIAGNOSTIC CLINIQUE (Croisé avec vos PDFs)</h4>
                    <p>{analysisResult.diagnosis}</p>
                  </div>
                </div>
              )}

              {resultTab === 'traitement' && (
                <div className="tab-content animate-fade-in">
                  <div className="ai-recommendation">
                    <h4>RECOMMANDATIONS IA</h4>
                    <p>{analysisResult.recommendation}</p>
                  </div>
                  <div className="treatment-details">
                    <h4>ROUTINE SUGGÉRÉE</h4>
                    <ul>
                      <li><strong>Matin :</strong> {analysisResult.routine.matin}</li>
                      <li><strong>Soir :</strong> {analysisResult.routine.soir}</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="waiting-state">
              <span className="waiting-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              </span>
              <p>L'analyse détaillée du patient apparaîtra ici.</p>
            </div>
          )}
        </div>

        <div className={`robot-side glass-panel ${isAnalyzing ? 'scanning-active' : ''}`}>
          <div className="robot-dialogue">
            <p>
              {isAnalyzing 
                ? "Analyse de l'image et croisement avec vos documents PDF..." 
                : analysisResult
                  ? "Analyse IA terminée ! Voici le rapport détaillé fondé sur vos ouvrages."
                  : selectedImage 
                    ? "Image reçue ! Prêt pour l'analyse IA." 
                    : "Bonjour Dr. Desouches ! Je suis prêt."}
            </p>
          </div>
          <img src={robotImg} alt="DermaNova Assistant Robot" className={`robot-image ${isAnalyzing ? 'floating' : ''}`} />
          <button 
            className={`start-analysis-btn ${isAnalyzing ? 'analyzing' : ''} ${analysisResult ? 'success' : ''}`} 
            onClick={startAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? "ANALYSE IA EN COURS..." : analysisResult ? "NOUVELLE ANALYSE" : "DÉMARRER L'ANALYSE IA"}
          </button>
        </div>
      </div>
    </div>
  );

  const renderPatientsList = () => (
    <div className="content-card animate-fade-in">
      <div className="card-header patients">
        <div className="title-area">
          <h2>LISTE DES <span className="brand-light">PATIENTS</span></h2>
          <p className="card-description">
            Sélectionnez un patient pour accéder à son dossier complet et ses analyses.
          </p>
        </div>
        <button className="premium-btn-small outline" onClick={() => setIsNewPatientModalOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px', verticalAlign: 'middle'}}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Nouveau Patient
        </button>
      </div>
      
      <div className="patients-list glass-panel" style={{padding: '1.5rem'}}>
        {patients.map(patient => (
          <div key={patient.id} className="patient-list-item">
            <div className="patient-avatar-small">{patient.initial}</div>
            <div className="patient-info-row">
              <h3>{patient.name}</h3>
              <span className="patient-age">{patient.age} ans</span>
            </div>
            <div className="patient-date">{patient.date}</div>
            <span className={`status-badge ${patient.statusClass}`}>{patient.status}</span>
            <button className="view-btn-icon">➔</button>
          </div>
        ))}
        {patients.length === 0 && <p style={{opacity: 0.5, textAlign: 'center'}}>Aucun patient enregistré.</p>}
      </div>
    </div>
  );

  const renderPdfKnowledge = () => (
    <div className="content-card animate-fade-in">
      <div className="card-header">
        <h2>CONNAISSANCES <span className="brand-light">PDF & IA</span></h2>
      </div>
      <p className="card-description">
        Importez vos ouvrages. L'IA va réellement les lire (extraction de texte) et s'en servir comme base de vérité pour chaque diagnostic.
      </p>

      <div className="pdf-knowledge-layout">
        <div className="pdf-upload-section glass-panel-glow" onClick={() => pdfInputRef.current.click()}>
          <div className="upload-icon-ring pdf-icon">
            <span className="upload-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </span>
          </div>
          <h3>Importer un Ouvrage (PDF)</h3>
          <p>Extraction intelligente du texte par l'IA</p>
          <input 
            type="file" 
            accept=".pdf" 
            ref={pdfInputRef} 
            style={{ display: 'none' }} 
            onChange={handlePdfUpload} 
          />
          {isPdfUploading && <p className="uploading-text">Lecture et extraction du PDF en cours...</p>}
        </div>

        <div className="pdf-library">
          <h3>Ouvrages stockés en mémoire locale</h3>
          <ul className="library-list">
            {pdfs.map(pdf => (
              <li key={pdf.id} className="library-item glass-panel">
                <span className="book-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </span>
                <div className="book-info">
                  <h4>{pdf.name}</h4>
                  <span>{pdf.size} • Intégré ({(pdf.content.length / 1024).toFixed(1)} KB lu)</span>
                </div>
                <button className="logout-btn-text" style={{margin:0, color:'#ff6b6b'}} onClick={() => setPdfs(pdfs.filter(p => p.id !== pdf.id))}>Supprimer</button>
              </li>
            ))}
            {pdfs.length === 0 && <p style={{opacity: 0.5}}>Aucun PDF en mémoire.</p>}
          </ul>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="glass-panel content-card animate-fade-in">
      <div className="card-header">
        <h2>PARAMÈTRES <span className="brand-light">SYSTÈME & IA</span></h2>
      </div>
      <p className="card-description">
        Configurez votre clinique et connectez le moteur d'Intelligence Artificielle.
      </p>

      <div className="settings-grid">
        <div className="setting-group glass-panel" style={{gridColumn: '1 / -1'}}>
          <h3>Configuration du Cerveau IA (Gemini)</h3>
          <p style={{fontSize: '0.85rem', color: '#ccc', marginBottom: '1rem'}}>
            Pour que DermaNova puisse analyser visuellement les photos et comprendre vos PDF, une clé API Google Gemini est requise.
          </p>
          <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
            <input 
              type="password" 
              placeholder="Collez votre clé API Gemini ici (AIzaSy...)" 
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              style={{
                flexGrow: 1, padding: '0.8rem 1rem', borderRadius: '12px', 
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', 
                color: '#fff', outline: 'none'
              }}
            />
            <button className="premium-btn-small" style={{background: '#ffffff', color: '#000'}} onClick={saveGeminiKey}>
              {isKeySaved ? "✓ Clé Sauvegardée" : "Enregistrer la clé"}
            </button>
          </div>
        </div>

        <div className="setting-group glass-panel">
          <h3>Préférences de l'Assistant</h3>
          <label className="setting-toggle">
            <span>Forcer le croisement avec les PDF</span>
            <input type="checkbox" defaultChecked />
          </label>
        </div>

        <div className="setting-group glass-panel">
          <h3>Interface & Compte</h3>
          <div className="setting-action">
            <span>Clinique : Institut Dermatologique de Paris</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-container" style={{ backgroundImage: `url(${bgImage})` }}>
      <div className="dashboard-overlay"></div>
      
      <div className="dashboard-layout">
        
        {/* Sidebar à gauche */}
        <aside className="main-sidebar glass-panel">
          <div className="sidebar-logo-container">
            <img src={logo} alt="DermaNova Logo" className="sidebar-logo" />
          </div>
          
          <nav className="sidebar-nav">
            {tabs.map(tab => (
              <button 
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="user-profile-card">
              <div className="profile-header">
                <div className="user-avatar-placeholder">D</div>
                <div className="user-info">
                  <span className="user-name">Dr. Desouches</span>
                  <span className="user-role">Dermatologue</span>
                </div>
              </div>
              <button className="logout-btn-text" onClick={onLogout}>Se déconnecter</button>
            </div>
          </div>
        </aside>

        {/* Contenu principal */}
        <div className="dashboard-content">
          <main className="dashboard-main full-height">
            {activeTab === 'dashboard' && (
              <div className="dashboard-grid layout-single">
                {renderScannerCard()}
              </div>
            )}
            
            {activeTab === 'patients' && (
              <div className="layout-single">
                {renderPatientsList()}
              </div>
            )}

            {activeTab === 'pdf_knowledge' && (
              <div className="layout-single">
                {renderPdfKnowledge()}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="layout-single">
                {renderSettings()}
              </div>
            )}
          </main>
        </div>
        
      </div>

      {/* Modal Nouveau Patient */}
      {isNewPatientModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Nouveau Patient</h3>
            <form className="modal-form" onSubmit={handleAddPatient}>
              <input 
                type="text" 
                placeholder="Nom complet (ex: Jean Dupont)" 
                value={newPatientData.name}
                onChange={e => setNewPatientData({...newPatientData, name: e.target.value})}
                autoFocus
                required
              />
              <input 
                type="number" 
                placeholder="Âge" 
                value={newPatientData.age}
                onChange={e => setNewPatientData({...newPatientData, age: e.target.value})}
                required
              />
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsNewPatientModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn-submit">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
